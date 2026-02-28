import { useMemo } from 'react';

import { PaycheckService } from '../services/paycheckService';

/**
 * Custom hook that provides memoized PaycheckService calculations.
 * The service instance and derived paycheck dates are only recalculated
 * when paycheckSettings actually changes, not on every render.
 *
 * @param {Object} paycheckSettings - The paycheck settings from the store
 * @returns {{ paycheckService: PaycheckService, paycheckDates: Object }}
 */
export const usePaycheckCalculations = paycheckSettings => {
  const paycheckService = useMemo(
    () => new PaycheckService(paycheckSettings),
    [paycheckSettings],
  );

  const paycheckDates = useMemo(
    () => paycheckService.calculatePaycheckDates(),
    [paycheckService],
  );

  return { paycheckService, paycheckDates };
};
