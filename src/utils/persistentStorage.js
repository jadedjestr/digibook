import { logger } from './logger';

/**
 * Ask the browser to keep this origin's storage.
 *
 * Every financial record in Digibook lives in IndexedDB on the device. Browsers
 * treat ordinary site storage as disposable and evict it — under disk pressure,
 * and on iOS Safari after roughly seven days without a visit for a site that
 * has not been added to the home screen. For this app that is silent data loss,
 * not a cache miss.
 *
 * A granted persistence request exempts the origin from routine eviction.
 * Support and grant criteria vary: Chrome and Firefox decide from engagement
 * signals, and Safari rarely grants it outside an installed web app. So this is
 * an improvement where it lands, never a guarantee — adding the app to the home
 * screen remains the reliable fix on iOS.
 *
 * Fire-and-forget: never blocks startup, never throws.
 *
 * @returns {Promise<{supported: boolean, persisted: boolean}>}
 */
export async function requestPersistentStorage() {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.persist) {
      return { supported: false, persisted: false };
    }

    // Already granted: don't ask again, some browsers count repeat prompts
    // against the origin.
    if (await navigator.storage.persisted()) {
      logger.debug('Storage already persistent');
      return { supported: true, persisted: true };
    }

    const persisted = await navigator.storage.persist();
    if (persisted) {
      logger.success(
        'Storage marked persistent — data is exempt from eviction',
      );
    } else {
      logger.warn(
        'Persistent storage was not granted. On iOS, add the app to your home screen to keep data from being evicted.',
      );
    }
    return { supported: true, persisted };
  } catch (error) {
    logger.warn('Could not request persistent storage:', error);
    return { supported: false, persisted: false };
  }
}
