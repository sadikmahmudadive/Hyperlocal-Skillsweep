import { applyApiSecurityHeaders, createLimiter, enforceRateLimit } from '../../../lib/security';
import { RATE_LIMIT_PROFILES } from '../../../lib/rateLimitProfiles';
import { geocodeAddress, listAllUsers, patchUser } from '../../../lib/firestoreStore';

const limiter = createLimiter(RATE_LIMIT_PROFILES.testFixUsernameIndex);

function hasValidCoordinates(user) {
  const coords = user?.location?.coordinates;
  return (
    Array.isArray(coords) &&
    coords.length >= 2 &&
    Number.isFinite(Number(coords[0])) &&
    Number.isFinite(Number(coords[1])) &&
    !(Number(coords[0]) === 0 && Number(coords[1]) === 0)
  );
}

export default async function handler(req, res) {
  applyApiSecurityHeaders(res);

  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ message: 'Not found' });
  }

  if (!['POST', 'GET'].includes(req.method)) {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  if (!(await enforceRateLimit(limiter, req, res))) return;

  try {
    const dryRun = String(req.query.dryRun ?? req.body?.dryRun ?? 'false').toLowerCase() !== 'false';
    const limit = Math.max(1, Math.min(Number(req.query.limit ?? req.body?.limit ?? 500), 5000));

    const users = await listAllUsers(limit);
    const candidates = users.filter((user) => {
      if (hasValidCoordinates(user)) return false;
      const address = String(user?.location?.address || user?.address || '').trim();
      return !!address;
    });

    let updated = 0;
    let failed = 0;
    const samples = [];

    for (const user of candidates) {
      const userId = String(user.id || user._id);
      const address = String(user?.location?.address || user?.address || '').trim();
      const coords = await geocodeAddress(address);

      if (!coords) {
        failed += 1;
        if (samples.length < 15) {
          samples.push({ userId, address, status: 'geocode-failed' });
        }
        continue;
      }

      if (!dryRun) {
        await patchUser(userId, {
          location: {
            type: 'Point',
            coordinates: coords,
            address,
          }
        });
      }

      updated += 1;
      if (samples.length < 15) {
        samples.push({ userId, address, coordinates: coords, status: dryRun ? 'would-update' : 'updated' });
      }
    }

    return res.status(200).json({
      success: true,
      dryRun,
      scanned: users.length,
      candidates: candidates.length,
      updated,
      failed,
      samples,
      hint: dryRun
        ? 'Run with dryRun=false to apply updates.'
        : 'Backfill applied. Re-run search/map to see updated results.'
    });
  } catch (error) {
    console.error('Backfill coordinates error:', error);
    return res.status(500).json({ message: 'Backfill failed', error: error?.message || 'Unknown error' });
  }
}
