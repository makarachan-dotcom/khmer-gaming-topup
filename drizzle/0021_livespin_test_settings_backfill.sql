UPDATE `live_spin_events`
SET `winnerCount` = 1,
    `consolationGiftCount` = 0
WHERE `isTest` = true;
