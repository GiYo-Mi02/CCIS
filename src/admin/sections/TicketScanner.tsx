import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Camera, AlertTriangle, CheckCircle, XCircle, RefreshCw, Send, ShieldAlert, History, Volume2, VolumeX, Calendar, SwitchCamera, FileImage } from 'lucide-react';
import { Html5Qrcode, CameraDevice } from 'html5-qrcode';
import { supabase } from '../../lib/supabase';
import { postgrestEquals } from '../../lib/postgrest';
import { useAdmin } from '../AdminContext';

interface ScanResult {
  status: 'idle' | 'scanning' | 'processing' | 'success' | 'warning' | 'error';
  message: string;
  student?: {
    name: string;
    studentNumber: string;
    section: string;
    program: string;
    eventTitle: string;
    attendedAt?: string;
    registrationStatus?: 'Registrant' | 'Walk-in / Non-registrant';
  };
}

interface ScanLogEntry {
  id: string;
  timestamp: Date;
  result: ScanResult;
}

interface EventOption {
  id: string;
  title: string;
  event_date: string;
}

const COOLDOWN_MS = 2000; // 2 second cooldown between scans
const AUTO_DISMISS_SUCCESS_MS = 3500; // auto-dismiss success/warning after 3.5s
const AUTO_DISMISS_ERROR_MS = 5000; // auto-dismiss error after 5s

export default function TicketScanner() {
  const { showToast } = useAdmin();
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [manualId, setManualId] = useState('');
  const [result, setResult] = useState<ScanResult>({ status: 'idle', message: 'Ready to scan.' });
  const [scanLog, setScanLog] = useState<ScanLogEntry[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [scanCount, setScanCount] = useState(0);

  // Events list for targeting specific event attendance
  const [events, setEvents] = useState<EventOption[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const processingRef = useRef(false);
  const cooldownRef = useRef(false);
  const lastScannedRef = useRef<string>('');
  const autoDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scannerId = 'ccis-qr-reader';

  // Fetch active events list on mount
  useEffect(() => {
    const fetchEvents = async () => {
      const { data, error } = await supabase
        .from('events')
        .select('id, title, event_date')
        .order('event_date', { ascending: false })
        .limit(20);
      
      if (!error && data) {
        setEvents(data);
        if (data.length > 0) {
          setSelectedEventId(data[0].id);
        }
      }
    };
    fetchEvents();
  }, []);

  // Discover every available camera. Laptop webcams are normally user-facing,
  // so they must not be excluded in favour of phone-style rear cameras.
  const refreshCameras = useCallback(async () => {
    try {
      const devices = await Html5Qrcode.getCameras();
      if (devices && devices.length > 0) {
        setCameras(devices);

        const preferredBack = devices.find(d =>
          d.label.toLowerCase().includes('back') || 
          d.label.toLowerCase().includes('environment') || 
          d.label.toLowerCase().includes('rear')
        );

        // Preserve an existing selection; otherwise prefer a rear camera on
        // mobile and the first available (usually integrated) webcam on laptops.
        setSelectedCameraId(currentId =>
          devices.some(device => device.id === currentId)
            ? currentId
            : (preferredBack || devices[0]).id
        );
      } else {
        setCameras([]);
        setSelectedCameraId('');
      }
      return devices || [];
    } catch (err) {
      console.warn('Camera enumeration note:', err);
      setCameras([]);
      return [];
    }
  }, []);

  useEffect(() => {
    refreshCameras();
    const mediaDevices = navigator.mediaDevices;
    const handleDeviceChange = () => refreshCameras();
    mediaDevices?.addEventListener?.('devicechange', handleDeviceChange);

    return () => {
      mediaDevices?.removeEventListener?.('devicechange', handleDeviceChange);
      stopScanning();
      if (autoDismissTimerRef.current) clearTimeout(autoDismissTimerRef.current);
    };
  }, [refreshCameras]);

  const startScanning = async (overrideCameraId?: string) => {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setResult({
        status: 'error',
        message: 'Camera access requires HTTPS or localhost. Open the admin portal using a secure URL and try again.'
      });
      return;
    }

    setResult({ status: 'scanning', message: 'Opening camera…' });
    setIsScanning(true);
    processingRef.current = false;
    cooldownRef.current = false;
    lastScannedRef.current = '';

    try {
      if (html5QrCodeRef.current) {
        await stopScanning();
      }

      // Check if scanner container element exists in DOM
      const container = document.getElementById(scannerId);
      if (!container) {
        throw new Error('Scanner container element not found.');
      }

      const html5QrCode = new Html5Qrcode(scannerId);
      html5QrCodeRef.current = html5QrCode;

      // Re-enumerate from the click event so the browser can prompt for camera
      // permission and newly connected laptop webcams become available.
      const detectedCameras = await refreshCameras();
      const requestedCameraId = overrideCameraId || selectedCameraId;
      const camToUse = detectedCameras.some(camera => camera.id === requestedCameraId)
        ? requestedCameraId
        : detectedCameras[0]?.id;
      
      const scanCallbacks = {
        onSuccess: async (decodedText: string) => {
          if (processingRef.current || cooldownRef.current) return;
          if (decodedText === lastScannedRef.current) return;

          processingRef.current = true;
          lastScannedRef.current = decodedText;

          await handleValidateTicket(decodedText);

          cooldownRef.current = true;
          setTimeout(() => {
            cooldownRef.current = false;
            lastScannedRef.current = '';
          }, COOLDOWN_MS);

          processingRef.current = false;
        },
        onError: () => {}
      };

      const qrConfig = {
        fps: 15,
        qrbox: (width: number, height: number) => {
          const size = Math.floor(Math.min(width, height) * 0.8);
          return { width: size, height: size };
        }
      };

      // Prefer the selected device. If none is enumerated yet, try a rear
      // camera first (phones), then a user-facing camera (laptops).
      let startError: any = null;
      if (camToUse) {
        try {
          await html5QrCode.start(camToUse, qrConfig, scanCallbacks.onSuccess, scanCallbacks.onError);
        } catch (errId) {
          startError = errId;
        }
      }

      if (!camToUse || startError) {
        try {
          await html5QrCode.start({ facingMode: "environment" }, qrConfig, scanCallbacks.onSuccess, scanCallbacks.onError);
          startError = null;
        } catch (errEnv) {
          startError = errEnv;
        }
      }

      if (startError) {
        try {
          await html5QrCode.start({ facingMode: "user" }, qrConfig, scanCallbacks.onSuccess, scanCallbacks.onError);
          startError = null;
        } catch (errUser) {
          startError = errUser;
        }
      }

      if (startError) {
        throw startError;
      }

      setIsScanning(true);
      setResult({ status: 'scanning', message: 'Camera active. Position the QR code inside the frame.' });
      refreshCameras();
    } catch (err: any) {
      console.error('Failed to start back camera scanner:', err);
      setIsScanning(false);
      const isPermissionErr = err.name === 'NotAllowedError' || err.message?.toLowerCase().includes('permission') || err.message?.toLowerCase().includes('denied');
      setResult({
        status: 'error',
        message: isPermissionErr
          ? 'Camera permission blocked. Click the lock/tune icon in your browser address bar to allow Camera access.'
          : `Camera error: ${err.message || 'No usable camera was detected'}. Ensure the webcam is enabled and no other app is using it, then try again.`
      });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setResult({ status: 'processing', message: 'Scanning uploaded QR image...' });

    try {
      let scanner = html5QrCodeRef.current;
      if (!scanner) {
        scanner = new Html5Qrcode(scannerId);
        html5QrCodeRef.current = scanner;
      }

      const decodedText = await scanner.scanFile(file, true);
      if (decodedText) {
        await handleValidateTicket(decodedText);
      }
    } catch (err: any) {
      console.error('Failed to scan file:', err);
      playSound('error');
      const errorResult: ScanResult = {
        status: 'error',
        message: 'Could not read a valid QR code from this image. Please try another photo.'
      };
      setResult(errorResult);
      scheduleAutoDismiss(AUTO_DISMISS_ERROR_MS);
    } finally {
      e.target.value = '';
    }
  };

  const stopScanning = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        await html5QrCodeRef.current.clear();
      } catch (err) {
        console.warn('Error clearing scanner:', err);
      }
      html5QrCodeRef.current = null;
    }
    setIsScanning(false);
  };

  const handleCameraChange = (cameraId: string) => {
    setSelectedCameraId(cameraId);
    if (isScanning) {
      startScanning(cameraId);
    }
  };

  const playSound = useCallback((type: 'success' | 'warning' | 'error') => {
    if (!soundEnabled) return;
    try {
      const frequencies: Record<string, number[]> = {
        success: [523.25, 659.25],
        warning: [329.63, 329.63],
        error: [196.00, 146.83],
      };
      
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const playBeep = (freq: number, startTime: number, duration: number) => {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.frequency.value = freq;
        gainNode.gain.setValueAtTime(0.1, startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        osc.start(startTime);
        osc.stop(startTime + duration);
      };

      const notes = frequencies[type];
      notes.forEach((freq, index) => {
        playBeep(freq, audioCtx.currentTime + index * 0.12, 0.2);
      });
    } catch (e) {
      // Audio context disabled/blocked by browser gesture
    }
  }, [soundEnabled]);

  const scheduleAutoDismiss = useCallback((duration: number) => {
    if (autoDismissTimerRef.current) clearTimeout(autoDismissTimerRef.current);
    autoDismissTimerRef.current = setTimeout(() => {
      setResult({ status: 'scanning', message: 'Camera active. Position QR code inside the frame.' });
    }, duration);
  }, []);

  const handleValidateTicket = async (ticketId: string) => {
    const trimmedId = ticketId.trim();
    if (!trimmedId) return;

    setResult({ status: 'processing', message: 'Validating ticket credentials against database...' });

    try {
      // 1. Check if Audience Attendance QR Pass (JSON, prefix, token, or student ID)
      let audienceData: any = null;
      if (trimmedId.startsWith('{') && trimmedId.endsWith('}')) {
        try {
          const parsed = JSON.parse(trimmedId);
          if (parsed.type === 'CCIS_AUDIENCE_PASS') {
            audienceData = parsed;
          }
        } catch {
          // not JSON, fallback
        }
      } else if (trimmedId.startsWith('CCIS-AUDIENCE:')) {
        const parts = trimmedId.split(':');
        audienceData = {
          student_id: parts[1],
          profile_id: parts[2]
        };
      } else if (trimmedId.startsWith('CCIS-PASS-') || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmedId)) {
        // Match by secure pass token in database
        const { data: matchedProf } = await supabase
          .from('profiles')
          .select('*')
          .eq('attendance_qr_code', trimmedId)
          .maybeSingle();

        if (matchedProf) {
          audienceData = {
            profile_id: matchedProf.id,
            student_id: matchedProf.student_number,
            name: matchedProf.full_name,
            program: matchedProf.program,
            section: matchedProf.section,
            token: matchedProf.attendance_qr_code
          };
        }
      }

      if (audienceData) {
        let profQuery = supabase.from('profiles').select('*');
        if (audienceData.profile_id) {
          profQuery = profQuery.eq('id', audienceData.profile_id);
        } else if (audienceData.student_id) {
          profQuery = profQuery.eq('student_number', audienceData.student_id);
        } else if (audienceData.token) {
          profQuery = profQuery.eq('attendance_qr_code', audienceData.token);
        }

        const { data: stProfile, error: profErr } = await profQuery.maybeSingle();
        if (profErr || !stProfile) {
          playSound('error');
          const errorResult: ScanResult = {
            status: 'error',
            message: 'Unrecognized Student Pass! No profile record found in the database.'
          };
          setResult(errorResult);
          addToLog(trimmedId, errorResult);
          scheduleAutoDismiss(AUTO_DISMISS_ERROR_MS);
          return;
        }

        // VALIDATION CHECK 1: Profile Approval Status
        if (stProfile.status !== 'approved') {
          playSound('warning');
          const warningResult: ScanResult = {
            status: 'warning',
            message: `Student Pass Inactive: Profile status is '${stProfile.status || 'pending'}'. Must be approved by admin.`,
            student: {
              name: stProfile.full_name || audienceData.name || 'Student',
              studentNumber: stProfile.student_number || audienceData.student_id || '—',
              section: stProfile.section || audienceData.section || '—',
              program: stProfile.program || audienceData.program || 'CCIS',
              eventTitle: 'Audience Pass Verification (Pending)'
            }
          };
          setResult(warningResult);
          addToLog(trimmedId, warningResult);
          scheduleAutoDismiss(AUTO_DISMISS_ERROR_MS);
          return;
        }

        // VALIDATION CHECK 2: Banned Check
        if (stProfile.banned) {
          playSound('error');
          const errorResult: ScanResult = {
            status: 'error',
            message: 'Access Denied: Student account is suspended or banned.'
          };
          setResult(errorResult);
          addToLog(trimmedId, errorResult);
          scheduleAutoDismiss(AUTO_DISMISS_ERROR_MS);
          return;
        }

        // VALIDATION CHECK 3: Record Attendance in Database for Selected Event
        const targetEvent = events.find(e => e.id === selectedEventId);
        const eventTitle = targetEvent ? targetEvent.title : 'General Audience Attendance';
        let attendanceResult: { is_event_registrant?: boolean } | null = null;

        if (selectedEventId) {
          const attendanceToken = stProfile.attendance_qr_code;
          if (!attendanceToken) {
            playSound('error');
            const errorResult: ScanResult = {
              status: 'error',
              message: 'This profile does not have a valid audience attendance token.'
            };
            setResult(errorResult);
            addToLog(trimmedId, errorResult);
            scheduleAutoDismiss(AUTO_DISMISS_ERROR_MS);
            return;
          }

          const { data: attendanceData, error: attendanceErr } = await supabase.rpc('check_in_audience', {
            p_event_id: selectedEventId,
            p_attendance_token: attendanceToken,
          }).single();
          const attendance = attendanceData as {
            was_already_attended: boolean;
            attended_at: string | null;
            is_event_registrant: boolean;
            attendance_origin: 'registered' | 'walk_in';
          } | null;
          attendanceResult = attendance;

          if (attendanceErr || !attendance) {
            playSound('error');
            const errorResult: ScanResult = {
              status: 'error',
              message: attendanceErr?.message?.includes('query returned no rows')
                ? 'Invalid universal QR: this pass is not assigned to an active approved student.'
                : 'Unable to record audience attendance. Please try again.'
            };
            setResult(errorResult);
            addToLog(trimmedId, errorResult);
            scheduleAutoDismiss(AUTO_DISMISS_ERROR_MS);
            return;
          }

          if (attendance.was_already_attended) {
            playSound('warning');
            const warningResult: ScanResult = {
              status: 'warning',
              message: 'Already Checked In! Audience pass already scanned for this event.',
              student: {
                name: stProfile.full_name || audienceData.name || 'Student',
                studentNumber: stProfile.student_number || audienceData.student_id || '—',
                section: stProfile.section || audienceData.section || '—',
                program: stProfile.program || audienceData.program || 'CCIS',
                eventTitle,
                attendedAt: attendance.attended_at ? new Date(attendance.attended_at).toLocaleTimeString() : 'Previously',
                registrationStatus: attendance.is_event_registrant ? 'Registrant' : 'Walk-in / Non-registrant'
              }
            };
            setResult(warningResult);
            addToLog(trimmedId, warningResult);
            scheduleAutoDismiss(AUTO_DISMISS_SUCCESS_MS);
            return;
          }
        }

        playSound('success');
        setScanCount(prev => prev + 1);
        const successResult: ScanResult = {
          status: 'success',
          message: 'Audience Attendance Verified! Check-in logged in database.',
          student: {
            name: stProfile.full_name || audienceData.name || 'Student',
            studentNumber: stProfile.student_number || audienceData.student_id || '—',
            section: stProfile.section || audienceData.section || '—',
            program: stProfile.program || audienceData.program || 'CCIS',
            eventTitle,
            registrationStatus: selectedEventId
              ? (attendanceResult?.is_event_registrant
                  ? 'Registrant'
                  : 'Walk-in / Non-registrant')
              : undefined
          }
        };
        setResult(successResult);
        addToLog(trimmedId, successResult);
        showToast(`Audience attendance confirmed for ${stProfile.full_name || 'Student'}`, 'success');
        scheduleAutoDismiss(AUTO_DISMISS_SUCCESS_MS);
        return;
      }

      // 2. Otherwise check specific Event Registration
      const { data: reg, error } = await supabase
        .from('event_registrations')
        .select('*, events(title), profiles(full_name, student_number, program, section)')
        .eq('id', trimmedId)
        .maybeSingle();

      if (error) {
        console.error('Ticket scan query error:', error.message);
        playSound('error');
        const errorResult: ScanResult = {
          status: 'error',
          message: 'Unable to verify ticket credentials. Please try scanning again.'
        };
        setResult(errorResult);
        addToLog(trimmedId, errorResult);
        scheduleAutoDismiss(AUTO_DISMISS_ERROR_MS);
        return;
      }

      if (!reg) {
        playSound('error');
        const errorResult: ScanResult = {
          status: 'error',
          message: 'Invalid Ticket! This ID does not match any registered student records.'
        };
        setResult(errorResult);
        addToLog(trimmedId, errorResult);
        scheduleAutoDismiss(AUTO_DISMISS_ERROR_MS);
        return;
      }

      const profile = reg.profiles as any;
      const eventTitle = reg.events?.title || 'Event';
      const studentData = {
        name: profile?.full_name || 'Student',
        studentNumber: profile?.student_number || '—',
        section: profile?.section || '—',
        program: profile?.program || 'CCIS',
        eventTitle,
        registrationStatus: reg.attendance_origin === 'walk_in' ? 'Walk-in / Non-registrant' as const : 'Registrant' as const,
      };

      if (reg.status === 'attended') {
        playSound('warning');
        const warningResult: ScanResult = {
          status: 'warning',
          message: 'Already Checked In! This ticket has already been used for entry.',
          student: {
            ...studentData,
            attendedAt: reg.updated_at ? new Date(reg.updated_at).toLocaleTimeString() : 'Previously'
          }
        };
        setResult(warningResult);
        addToLog(trimmedId, warningResult);
        scheduleAutoDismiss(AUTO_DISMISS_SUCCESS_MS);
      } else {
        // Mark as attended
        const { error: updateErr } = await supabase
          .from('event_registrations')
          .update({ status: 'attended', attended_at: new Date().toISOString() })
          .eq('id', trimmedId);

        if (updateErr) {
          console.error('Attendance status update error:', updateErr.message);
          playSound('error');
          const errorResult: ScanResult = {
            status: 'error',
            message: 'Failed to update attendance record. Please try again.'
          };
          setResult(errorResult);
          addToLog(trimmedId, errorResult);
          scheduleAutoDismiss(AUTO_DISMISS_ERROR_MS);
          return;
        }

        playSound('success');
        setScanCount(prev => prev + 1);
        const successResult: ScanResult = {
          status: 'success',
          message: 'Entry Authorized! Attendance registered successfully.',
          student: studentData
        };
        setResult(successResult);
        addToLog(trimmedId, successResult);
        showToast(`Attendance checked in for ${studentData.name}`, 'success');
        scheduleAutoDismiss(AUTO_DISMISS_SUCCESS_MS);
      }
    } catch (err: any) {
      console.error('Validation error:', err);
      playSound('error');
      const errorResult: ScanResult = {
        status: 'error',
        message: 'An unexpected system error occurred during ticket validation.'
      };
      setResult(errorResult);
      addToLog(trimmedId, errorResult);
      scheduleAutoDismiss(AUTO_DISMISS_ERROR_MS);
    }
  };

  const addToLog = (ticketId: string, scanResult: ScanResult) => {
    setScanLog(prev => [{
      id: ticketId.slice(0, 8),
      timestamp: new Date(),
      result: scanResult,
    }, ...prev].slice(0, 20)); // Keep last 20 entries
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualId.trim()) {
      // Reset gates for manual entry
      processingRef.current = false;
      cooldownRef.current = false;
      handleValidateTicket(manualId);
      setManualId('');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in">
      {/* Stats bar */}
      <div className="flex items-center justify-between bg-white border border-gray-100 rounded-2xl p-3 px-5 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${isScanning ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`} />
            <span className="text-xs font-bold text-[#1A3C2E] uppercase tracking-wider">
              {isScanning ? 'Camera Live' : 'Camera Offline'}
            </span>
          </div>
          <div className="h-4 w-px bg-gray-200" />
          <span className="text-xs font-mono text-[#5E6E64]">
            <strong className="text-[#1A3C2E]">{scanCount}</strong> checked in this session
          </span>
        </div>
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="p-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-[#5E6E64] transition-colors"
          title={soundEnabled ? 'Mute sounds' : 'Enable sounds'}
        >
          {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
        </button>
      </div>

      <div className="flex flex-col md:flex-row items-stretch gap-6">
        
        {/* LEFT COLUMN: Camera Feed & Controller */}
        <div className="flex-1 bg-white border border-gray-100 rounded-3xl p-5 shadow-sm flex flex-col items-center">
          <div className="flex items-center justify-between w-full mb-4 border-b border-gray-100 pb-3">
            <h3 className="font-sans font-black text-[#1A3C2E] text-base flex items-center gap-2">
              <Camera size={18} className="text-[#F5B400]" /> Ticket &amp; Audience Scanner
            </h3>
            <span className="text-[10px] font-mono bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold">
              AY 2026-2027
            </span>
          </div>

          {/* Active Event Target Selector */}
          <div className="w-full mb-4 bg-stone-50 border border-stone-200/80 p-3 rounded-2xl space-y-1.5 text-left">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#5E6E64] flex items-center gap-1.5">
              <Calendar size={12} className="text-[#1A3C2E]" /> Target Event for Attendance Logging:
            </label>
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs outline-none text-[#1A3C2E] font-bold focus:border-[#F5B400]"
            >
              <option value="">-- General Assembly / Any Event --</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title} ({ev.event_date})
                </option>
              ))}
            </select>
          </div>

          {/* Camera Selection controls */}
          <div className="w-full flex flex-col sm:flex-row gap-2 mb-4">
            <select
              value={selectedCameraId}
              onChange={(e) => handleCameraChange(e.target.value)}
              className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none text-[#222B26] font-semibold"
            >
              <option value="">Auto-detect camera</option>
              {cameras.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label || `Camera ${cameras.indexOf(c) + 1}`}
                </option>
              ))}
            </select>

            <button
              onClick={() => {
                if (isScanning) {
                  stopScanning();
                } else {
                  startScanning(selectedCameraId);
                }
              }}
              className={`px-5 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shrink-0 flex items-center justify-center gap-1.5 ${
                isScanning
                  ? 'bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100'
                  : 'bg-[#1A3C2E] hover:bg-[#255541] text-white shadow-xs'
              }`}
            >
              <Camera size={14} />
              <span>{isScanning ? 'Stop Camera' : 'Start Camera'}</span>
            </button>
          </div>

          {/* Scanner Viewport */}
          <div className="w-full relative aspect-square max-w-[320px] rounded-2xl overflow-hidden bg-black flex items-center justify-center border-4 border-gray-100 shadow-inner">
            <div id={scannerId} className="w-full h-full object-cover" />
            
            {/* Visual target reticle for scanning */}
            {isScanning && (
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                <div className="w-48 h-48 border-2 border-dashed border-[#F5B400] rounded-xl relative">
                  {/* Glowing scan bar animation */}
                  <div className="absolute left-0 right-0 h-[3px] bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse top-1/2 -translate-y-1/2" />
                </div>
              </div>
            )}

            {/* Scan result overlay — appears on top of live camera without stopping it */}
            {isScanning && result.status !== 'scanning' && result.status !== 'idle' && (
              <div className={`absolute inset-x-0 bottom-0 p-3 pointer-events-none transition-all duration-300 ${
                result.status === 'success' ? 'bg-emerald-900/85' :
                result.status === 'warning' ? 'bg-amber-900/85' :
                result.status === 'error' ? 'bg-rose-900/85' :
                'bg-black/70'
              }`}>
                <div className="flex items-center gap-2 text-white">
                  {result.status === 'success' && <CheckCircle size={18} className="text-emerald-300 shrink-0" />}
                  {result.status === 'warning' && <AlertTriangle size={18} className="text-amber-300 shrink-0" />}
                  {result.status === 'error' && <XCircle size={18} className="text-rose-300 shrink-0" />}
                  {result.status === 'processing' && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />}
                  <div className="min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-wider block">
                      {result.status === 'success' ? '✓ ENTRY GRANTED' :
                       result.status === 'warning' ? '⚠ DUPLICATE' :
                       result.status === 'error' ? '✕ DENIED' : 'VERIFYING...'}
                    </span>
                    {result.student && (
                      <span className="text-[11px] font-semibold block truncate opacity-90">
                        {result.student.name} — {result.student.eventTitle}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {!isScanning && (
              <div className="absolute inset-0 bg-[#222B26]/80 flex flex-col items-center justify-center p-6 text-center text-stone-300">
                <ShieldAlert size={36} className="text-stone-400 mb-2" />
                <p className="text-xs font-semibold">Camera is Offline</p>
                <p className="text-[10px] text-stone-400 mt-1">Select a camera and click Start Camera to begin scanning barcode passes.</p>
              </div>
            )}
          </div>

          {/* Secondary Actions: Scan Image File or Manual Input */}
          <div className="w-full mt-6 pt-4 border-t border-gray-100 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#5E6E64]">
                Alternative Entry Options
              </span>
              <label className="text-[11px] font-bold text-[#1A3C2E] hover:text-[#255541] cursor-pointer flex items-center gap-1.5 bg-stone-100 hover:bg-stone-200 px-3 py-1.5 rounded-xl transition-all shadow-2xs">
                <FileImage size={13} className="text-[#F5B400]" />
                <span>Upload QR Photo</span>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleFileUpload} 
                  className="hidden" 
                />
              </label>
            </div>

            {/* Manual Entry Fallback Form */}
            <form onSubmit={handleManualSubmit} className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Or paste QR payload / Student ID / Ticket UUID..."
                value={manualId}
                onChange={(e) => setManualId(e.target.value)}
                className="flex-1 bg-gray-50 border border-gray-200 focus:border-[#F5B400] rounded-xl px-4 py-2.5 text-xs outline-none text-[#222B26] font-semibold"
              />
              <button
                type="submit"
                className="bg-[#1A3C2E] hover:bg-[#255541] text-white p-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0"
                title="Validate Manual Ticket ID"
              >
                <Send size={14} />
              </button>
            </form>
          </div>
        </div>

        {/* RIGHT COLUMN: Validation Result Display + Scan Log */}
        <div className="w-full md:w-96 flex flex-col gap-4">
          {/* Current Result Panel */}
          <div className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm flex flex-col">
            <div>
              <h3 className="font-sans font-black text-[#1A3C2E] text-base mb-4 border-b border-gray-50 pb-2">
                Scanner Results
              </h3>

              {/* Status Graphic Display */}
              <div className="flex flex-col items-center text-center py-6 space-y-4">
                
                {result.status === 'idle' && (
                  <div className="w-16 h-16 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center border border-gray-200">
                    <RefreshCw size={24} className="animate-spin" style={{ animationDuration: '4s' }} />
                  </div>
                )}

                {result.status === 'scanning' && (
                  <div className="w-16 h-16 bg-[#F5B400]/10 text-[#F5B400] rounded-full flex items-center justify-center border border-[#F5B400]/20 animate-pulse">
                    <Camera size={24} />
                  </div>
                )}

                {result.status === 'processing' && (
                  <div className="w-16 h-16 bg-gray-50 text-gray-500 rounded-full flex items-center justify-center border border-gray-200">
                    <div className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}

                {result.status === 'success' && (
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center border border-emerald-200">
                    <CheckCircle size={28} />
                  </div>
                )}

                {result.status === 'warning' && (
                  <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center border border-amber-200 animate-bounce">
                    <AlertTriangle size={26} />
                  </div>
                )}

                {result.status === 'error' && (
                  <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center border border-rose-200">
                    <XCircle size={28} />
                  </div>
                )}

                <div className="space-y-1 px-4">
                  <h4 className={`text-xs font-black uppercase tracking-wider ${
                    result.status === 'success' ? 'text-emerald-700' :
                    result.status === 'warning' ? 'text-amber-700' :
                    result.status === 'error' ? 'text-rose-700' : 'text-gray-500'
                  }`}>
                    {result.status === 'idle' ? 'Ready to Scan' :
                     result.status === 'scanning' ? 'Awaiting Code' :
                     result.status === 'processing' ? 'Verifying...' :
                     result.status === 'success' ? 'Access Granted' :
                     result.status === 'warning' ? 'Duplicate Ticket' : 'Access Denied'}
                  </h4>
                  <p className="text-xs text-[#5E6E64] font-medium max-w-[240px] leading-relaxed">
                    {result.message}
                  </p>
                </div>
              </div>

              {/* Student details display if validation matches */}
              {result.student && (
                <div className="mt-4 bg-gray-50 border border-gray-150 rounded-2xl p-4 space-y-3 font-sans text-xs">
                  <div>
                    <span className="block text-[8.5px] font-mono text-gray-400 uppercase tracking-wider">Event Name</span>
                    <span className="font-bold text-[#1A3C2E] truncate block">{result.student.eventTitle}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="block text-[8.5px] font-mono text-gray-400 uppercase tracking-wider">Attendee Name</span>
                      <span className="font-bold text-[#222B26] block truncate">{result.student.name}</span>
                    </div>
                    <div>
                      <span className="block text-[8.5px] font-mono text-gray-400 uppercase tracking-wider">Section</span>
                      <span className="font-bold text-[#222B26] block font-mono">{result.student.section}</span>
                    </div>
                    <div>
                      <span className="block text-[8.5px] font-mono text-gray-400 uppercase tracking-wider">Student ID</span>
                      <span className="font-mono text-[#222B26] block">{result.student.studentNumber}</span>
                    </div>
                    <div>
                      <span className="block text-[8.5px] font-mono text-gray-400 uppercase tracking-wider">Program</span>
                      <span className="font-bold text-[#222B26] block">{result.student.program}</span>
                    </div>
                  </div>
                  {result.student.attendedAt && (
                    <div className="pt-2 border-t border-gray-200 flex items-center justify-between text-[9px] text-amber-700 font-mono">
                      <span>CHECKED IN AT:</span>
                      <span>{result.student.attendedAt}</span>
                    </div>
                  )}
                  {result.student.registrationStatus && (
                    <div className="pt-2 border-t border-gray-200 flex items-center justify-between text-[9px] font-mono">
                      <span className="text-gray-500">EVENT REGISTRATION:</span>
                      <span className={result.student.registrationStatus === 'Registrant' ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
                        {result.student.registrationStatus}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Scan History Log */}
          {scanLog.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-3xl p-4 shadow-sm">
              <h4 className="font-sans font-black text-[#1A3C2E] text-xs mb-3 flex items-center gap-1.5 uppercase tracking-wider">
                <History size={13} className="text-[#F5B400]" /> Recent Scans
              </h4>
              <div className="space-y-1.5 max-h-[220px] overflow-y-auto">
                {scanLog.map((entry, idx) => (
                  <div key={`${entry.id}-${idx}`} className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-gray-50 text-[10px]">
                    {entry.result.status === 'success' && <CheckCircle size={12} className="text-emerald-500 shrink-0" />}
                    {entry.result.status === 'warning' && <AlertTriangle size={12} className="text-amber-500 shrink-0" />}
                    {entry.result.status === 'error' && <XCircle size={12} className="text-rose-500 shrink-0" />}
                    <span className="font-mono text-[#5E6E64] shrink-0">{entry.id}…</span>
                    <span className="font-semibold text-[#222B26] truncate flex-1">
                      {entry.result.student?.name || entry.result.message.slice(0, 30)}
                    </span>
                    <span className="font-mono text-[#5E6E64] shrink-0">
                      {entry.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
