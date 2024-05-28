import { callActionInMain } from '../../../util/multitab';
import { IS_DELEGATED_BOTTOM_SHEET } from '../../../util/windowEnvironment';
import { addActionHandler, setGlobal } from '../../index';
import { updateVesting } from '../../reducers';

addActionHandler('openVestingModal', (global) => {
  setGlobal({ ...global, isVestingModalOpen: true });
});

addActionHandler('closeVestingModal', (global) => {
  setGlobal({ ...global, isVestingModalOpen: undefined });
});

addActionHandler('startClaimingVesting', (global) => {
  if (IS_DELEGATED_BOTTOM_SHEET) {
    callActionInMain('startClaimingVesting');
    return;
  }

  const accountId = global.currentAccountId!;
  global = { ...global, isVestingModalOpen: undefined };
  global = updateVesting(global, accountId, { isConfirmRequested: true });
  setGlobal(global);
});

addActionHandler('cancelClaimingVesting', (global) => {
  const accountId = global.currentAccountId!;
  global = updateVesting(global, accountId, { isConfirmRequested: undefined });
  setGlobal(global);
});

addActionHandler('clearVestingError', (global) => {
  const accountId = global.currentAccountId!;
  global = updateVesting(global, accountId, { error: undefined });
  setGlobal(global);
});
