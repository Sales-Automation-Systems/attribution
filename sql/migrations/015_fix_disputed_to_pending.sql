-- Fix existing DISPUTED records that should be DISPUTE_PENDING
-- These are records that were disputed before the DISPUTE_PENDING status was added
-- They should show as "In Review" if they have an OPEN dispute task

UPDATE attributed_domain ad
SET status = 'DISPUTE_PENDING', updated_at = NOW()
WHERE ad.status = 'DISPUTED'
  AND EXISTS (
    SELECT 1 FROM task t 
    WHERE t.attributed_domain_id = ad.id 
      AND t.type = 'DISPUTE' 
      AND t.status = 'OPEN'
  );

