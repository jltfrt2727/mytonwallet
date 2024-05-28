import type { ApiTransactionActivity } from '../../../api/types';
import { TransferState } from '../../types';

import { IS_CAPACITOR, TONCOIN_SLUG } from '../../../config';
import { groupBy } from '../../../util/iteratees';
import { callActionInNative } from '../../../util/multitab';
import { playIncomingTransactionSound } from '../../../util/notificationSound';
import { IS_DELEGATING_BOTTOM_SHEET } from '../../../util/windowEnvironment';
import { getIsTinyTransaction } from '../../helpers';
import { addActionHandler, setGlobal } from '../../index';
import {
  addLocalTransaction,
  addNewActivities,
  assignRemoteTxId,
  clearIsPinAccepted,
  removeLocalTransaction,
  updateAccountState,
  updateActivitiesIsLoadingByAccount,
  updateActivity,
  updateCurrentTransfer,
} from '../../reducers';
import { selectAccountState, selectLocalTransactions } from '../../selectors';

const TX_AGE_TO_PLAY_SOUND = 60000; // 1 min

addActionHandler('apiUpdate', (global, actions, update) => {
  switch (update.type) {
    case 'newLocalTransaction': {
      const {
        accountId,
        transaction,
        transaction: { amount, txId },
      } = update;

      global = updateActivity(global, accountId, transaction);
      global = addLocalTransaction(global, accountId, transaction);

      if (-amount === global.currentTransfer.amount) {
        global = updateCurrentTransfer(global, {
          txId,
          state: TransferState.Complete,
          isLoading: false,
        });
        if (IS_CAPACITOR) {
          global = clearIsPinAccepted(global);
        }
      }

      setGlobal(global);

      break;
    }

    case 'newActivities': {
      if (IS_DELEGATING_BOTTOM_SHEET) {
        callActionInNative('apiUpdate', update);
      }
      const { accountId, activities } = update;

      global = updateActivitiesIsLoadingByAccount(global, accountId, false);

      const localTransactions = selectLocalTransactions(global, accountId) ?? [];
      const withLocalIndex = activities.map((activity) => {
        if (activity.kind !== 'transaction') {
          return { activity, localIndex: -1, groupName: 'newActivities' };
        }

        const localIndex = localTransactions.findIndex(({
          amount, isIncoming, slug, normalizedAddress, inMsgHash,
        }) => {
          if (slug === TONCOIN_SLUG) {
            return inMsgHash === activity.inMsgHash && amount === activity.amount
              && normalizedAddress === activity.normalizedAddress;
          } else {
            return amount === activity.amount && !isIncoming && slug === activity.slug
              && normalizedAddress === activity.normalizedAddress;
          }
        });

        return { activity, localIndex, groupName: localIndex >= 0 ? 'localUpdates' : 'newActivities' };
      });

      const groups = groupBy(withLocalIndex, 'groupName');

      groups.localUpdates?.forEach(({ activity, localIndex }) => {
        const [localTransaction] = localTransactions.splice(localIndex, 1);

        const { txId, amount, shouldHide } = activity as ApiTransactionActivity;
        const localTxId = localTransaction.txId;
        global = assignRemoteTxId(global, accountId, localTxId, txId, amount, shouldHide);

        if (global.currentTransfer.txId === localTxId) {
          global = updateCurrentTransfer(global, { txId });
        }

        const { currentActivityId } = selectAccountState(global, accountId) || {};
        if (currentActivityId === localTxId) {
          global = updateAccountState(global, accountId, { currentActivityId: txId });
        }

        global = removeLocalTransaction(global, accountId, localTxId);
      });

      if (groups.newActivities) {
        const newActivities = groups.newActivities.map(({ activity }) => activity);

        global = addNewActivities(global, accountId, newActivities);

        const shouldPlaySound = newActivities.some((activity) => {
          return activity.kind === 'transaction'
            && activity.isIncoming
            && global.settings.canPlaySounds
            && (Date.now() - activity.timestamp < TX_AGE_TO_PLAY_SOUND)
            && !(
              global.settings.areTinyTransfersHidden
              && getIsTinyTransaction(activity, global.tokenInfo?.bySlug[activity.slug!])
            );
        });

        if (shouldPlaySound) {
          playIncomingTransactionSound();
        }
      }

      setGlobal(global);

      break;
    }
  }
});
