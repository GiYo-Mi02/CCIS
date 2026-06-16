import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Camera, AlertTriangle, CheckCircle, XCircle, RefreshCw, Send, ShieldAlert, History, Volume2, VolumeX } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { supabase } from '../../lib/supabase';
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
  };
}

interface ScanLogEntry {
  id: string;
  timestamp: Date;
  result: ScanResult;
}

const COOLDOWN_MS = 2000; // 2 second cooldown between scans
const AUTO_DISMISS_SUCCESS_MS = 3000; // auto-dismiss success/warning after 3s
const AUTO_DISMISS_ERROR_MS = 5000; // auto-dismiss error after 5s

export default function TicketScanner() {
  const { showToast } = useAdmin();
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [manualId, setManualId] = useState('');
  const [result, setResult] = useState<ScanResult>({ status: 'idle', message: 'Ready to scan.' });
  const [scanLog, setScanLog] = useState<ScanLogEntry[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [scanCount, setScanCount] = useState(0);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const processingRef = useRef(false);
  const cooldownRef = useRef(false);
  const lastScannedRef = useRef<string>('');
  const autoDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scannerId = 'ccis-qr-reader';

  // Request camera list on mount
  useEffect(() => {
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          setCameras(devices);
          const backCam = devices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('environment'));
          setSelectedCameraId(backCam ? backCam.id : devices[0].id);
        } else {
          setResult({
            status: 'error',
            message: 'No camera devices detected. Please ensure camera access is granted.'
          });
        }
      })
      .catch((err) => {
        console.error('Error getting cameras:', err);
        setResult({
          status: 'error',
          message: 'Failed to access camera hardware. Verify permissions and HTTPS context.'
        });
      });

    return () => {
      stopScanning();
      if (autoDismissTimerRef.current) clearTimeout(autoDismissTimerRef.current);
    };
  }, []);

  const startScanning = async (cameraId: string) => {
    if (!cameraId) return;
    setResult({ status: 'scanning', message: 'Camera active. Position QR code inside the frame.' });
    setIsScanning(true);
    processingRef.current = false;
    cooldownRef.current = false;
    lastScannedRef.current = '';

    try {
      if (html5QrCodeRef.current) {
        await stopScanning();
      }

      const html5QrCode = new Html5Qrcode(scannerId);
      html5QrCodeRef.current = html5QrCode;

      await html5QrCode.start(
        cameraId,
        {
          fps: 10,
          qrbox: (width, height) => {
            const size = Math.min(width, height) * 0.7;
            return { width: size, height: size };
          }
        },
        async (decodedText) => {
          // GATE: Skip if processing, in cooldown, or same QR as last scan
          if (processingRef.current || cooldownRef.current) return;
          if (decodedText === lastScannedRef.current) return;

          // Lock processing
          processingRef.current = true;
          lastScannedRef.current = decodedText;

          await handleValidateTicket(decodedText);

          // Start cooldown period — prevents duplicate scans
          cooldownRef.current = true;
          setTimeout(() => {
            cooldownRef.current = false;
            lastScannedRef.current = ''; // Allow re-scan of same code after cooldown
          }, COOLDOWN_MS);

          processingRef.current = false;
        },
        () => {
          // Verbose scanner noise, ignore
        }
      );
    } catch (err: any) {
      console.error('Failed to start scanner:', err);
      setIsScanning(false);
      setResult({
        status: 'error',
        message: `Camera error: ${err.message || err}. Ensure page runs in HTTPS or localhost.`
      });
    }
  };

  const stopScanning = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
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

    // Do NOT stop camera — just update the result overlay
    setResult({ status: 'processing', message: 'Validating ticket credentials against database...' });

    try {
      const { data: reg, error } = await supabase
        .from('event_registrations')
        .select('*, events(title), profiles(full_name, student_number, program, section)')
        .eq('id', trimmedId)
        .maybeSingle();

      if (error) {
        playSound('error');
        const errorResult: ScanResult = {
          status: 'error',
          message: `Database query failed: ${error.message}`
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
          .update({ status: 'attended' })
          .eq('id', trimmedId);

        if (updateErr) {
          playSound('error');
          const errorResult: ScanResult = {
            status: 'error',
            message: `Failed to update attendance: ${updateErr.message}`
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
          <h3 className="font-sans font-black text-[#1A3C2E] text-base mb-4 flex items-center gap-2 w-full text-left">
            <Camera size={18} className="text-[#F5B400]" /> Ticket Scanner
          </h3>

          {/* Camera Selection controls */}
          <div className="w-full flex flex-col sm:flex-row gap-3 mb-4">
            <select
              value={selectedCameraId}
              onChange={(e) => handleCameraChange(e.target.value)}
              className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none text-[#222B26] font-semibold"
            >
              {cameras.length === 0 ? (
                <option value="">Searching for cameras...</option>
              ) : (
                cameras.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label || `Camera ${cameras.indexOf(c) + 1}`}
                  </option>
                ))
              )}
            </select>

            <button
              onClick={() => {
                if (isScanning) {
                  stopScanning();
                } else {
                  startScanning(selectedCameraId);
                }
              }}
              disabled={cameras.length === 0}
              className={`px-5 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                isScanning
                  ? 'bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100'
                  : 'bg-[#1A3C2E] hover:bg-[#255541] text-white'
              }`}
            >
              {isScanning ? 'Stop Camera' : 'Start Camera'}
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

          {/* Manual Entry Fallback Form */}
          <form onSubmit={handleManualSubmit} className="w-full mt-6 pt-5 border-t border-gray-50 flex items-center gap-2">
            <input
              type="text"
              placeholder="Or enter Ticket UUID manually..."
              value={manualId}
              onChange={(e) => setManualId(e.target.value)}
              className="flex-1 bg-gray-50 border border-gray-200 focus:border-[#F5B400] rounded-xl px-4 py-2.5 text-xs outline-none text-[#222B26] font-semibold"
            />
            <button
              type="submit"
              className="bg-[#1A3C2E] hover:bg-[#255541] text-white p-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center"
              title="Validate Manual Ticket ID"
            >
              <Send size={14} />
            </button>
          </form>
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
