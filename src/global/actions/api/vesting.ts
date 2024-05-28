import type { ApiSubmitTransferOptions } from '../../../api/types';

import {
  CLAIM_ADDRESS,
  CLAIM_AMOUNT,
  CLAIM_COMMENT,
  IS_CAPACITOR,
  MYCOIN_TOKEN,
  MYCOIN_TOKEN_TESTNET,
} from '../../../config';
import { vibrateOnError, vibrateOnSuccess } from '../../../util/capacitor';
import { callActionInMain } from '../../../util/multitab';
import { IS_DELEGATED_BOTTOM_SHEET } from '../../../util/windowEnvironment';
import { callApi } from '../../../api';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import {
  clearIsPinAccepted,
  setIsPinAccepted,
  updateVesting,
} from '../../reducers';
import { selectVestingPartsReadyToUnfreeze } from '../../selectors';

addActionHandler('submitClaimingVesting', async (global, actions, { password }) => {
  const accountId = global.currentAccountId!;
  if (!(await callApi('verifyPassword', password))) {
    setGlobal(updateVesting(getGlobal(), accountId, { error: 'Wrong password, please try again.' }));

    return;
  }
  global = getGlobal();

  if (IS_CAPACITOR) {
    global = setIsPinAccepted(global);
  }

  global = updateVesting(global, accountId, {
    isLoading: true,
    error: undefined,
  });
  setGlobal(global);

  if (IS_CAPACITOR) {
    await vibrateOnSuccess(true);
  }

  if (IS_DELEGATED_BOTTOM_SHEET) {
    callActionInMain('submitClaimingVesting', { password });
    return;
  }

  global = getGlobal();
  const unfreezeRequestedIds = selectVestingPartsReadyToUnfreeze(global, accountId);

  const options: ApiSubmitTransferOptions = {
    accountId: global.currentAccountId!,
    password,
    toAddress: CLAIM_ADDRESS,
    amount: CLAIM_AMOUNT,
    comment: CLAIM_COMMENT,
  };
  const result = await callApi('submitTransfer', options);

  global = getGlobal();
  global = updateVesting(global, accountId, {
    isLoading: false,
  });
  setGlobal(global);

  if (!result || 'error' in result) {
    if (IS_CAPACITOR) {
      global = getGlobal();
      global = clearIsPinAccepted(global);
      setGlobal(global);
      void vibrateOnError();
    }
    actions.showError({ error: result?.error });
    return;
  } else if (IS_CAPACITOR) {
    void vibrateOnSuccess();
  }
  global = getGlobal();
  global = updateVesting(global, accountId, {
    isConfirmRequested: undefined,
    unfreezeRequestedIds,
  });
  setGlobal(global);
  actions.openVestingModal();
});

addActionHandler('loadMycoin', (global, actions) => {
  const { isTestnet } = global.settings;

  actions.importToken({ address: isTestnet ? MYCOIN_TOKEN_TESTNET : MYCOIN_TOKEN });
});
