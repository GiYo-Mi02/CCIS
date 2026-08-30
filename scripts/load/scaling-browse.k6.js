import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

const profile = __ENV.K6_PROFILE || '50';
const baseUrl = (__ENV.BASE_URL || 'http://127.0.0.1:4173').replace(/\/$/, '');

const profiles = {
  '50': { executor: 'constant-vus', vus: 50, duration: '2m' },
  '200': { executor: 'constant-vus', vus: 200, duration: '2m' },
  '500': { executor: 'ramping-vus', startVUs: 0, stages: [{ duration: '1m', target: 500 }, { duration: '2m', target: 500 }, { duration: '1m', target: 0 }] },
  '1700-population': { executor: 'shared-iterations', vus: 170, iterations: 1700, maxDuration: '10m' },
};

if (!profiles[profile]) throw new Error(`Unknown K6_PROFILE ${profile}`);

const mediaBytes = new Counter('media_bytes');
const apiRequests = new Counter('api_requests');
const duplicateRequests = new Counter('duplicate_requests');
const browsingSuccess = new Rate('browsing_success');
const pageDuration = new Trend('page_duration', true);

export const options = {
  scenarios: { browsing: profiles[profile] },
  thresholds: {
    http_req_failed: ['rate==0'],
    browsing_success: ['rate==1'],
    http_req_duration: ['p(95)<2000'],
  },
};

const sessionRequests = new Set();

function browse(path) {
  const url = `${baseUrl}${path}`;
  if (sessionRequests.has(url)) duplicateRequests.add(1);
  sessionRequests.add(url);
  const response = http.get(url, { tags: { resource: 'page' } });
  apiRequests.add(1);
  const length = Number(response.headers['Content-Length'] || 0);
  if (length > 0) mediaBytes.add(length);
  pageDuration.add(response.timings.duration);
  const ok = check(response, { [`${path} returned success`]: result => result.status >= 200 && result.status < 400 });
  browsingSuccess.add(ok);
  return response;
}

export default function () {
  sessionRequests.clear();
  browse('/');
  sleep(1);
  browse('/privacy');
  sleep(1);

  // Auth, Supabase API, Storage, and Realtime checks require an approved local or
  // staging account fixture. They are intentionally not pointed at production by
  // this public-browsing profile.
}
