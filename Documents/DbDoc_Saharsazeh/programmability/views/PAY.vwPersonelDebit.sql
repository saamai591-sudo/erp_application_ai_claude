


CREATE VIEW [PAY].[vwPersonelDebit]
AS 


SELECT vpd.Id,
       vpd.ItemType,
       vpd.Title,
       vpd.PartyID,
       vpd.Amount,
       vpd.[Date],
       vpd.PaymentTypeID,
       vpd.BranchID,
       vpd.CurrencyID,
       p.PersonelID,
       vpd.Amount-IsNull(pm.[Value],0) AS RemainValue
FROM   fin.vwPartyDebit         AS vpd
       INNER JOIN hrm.Personel  AS p
            ON  p.PartyID = vpd.PartyID
       LEFT JOIN (
                SELECT 
                pmd.PersonnelID,
                       PaymentSubjectID,
                       PettyCashCostItemID,
                       DebitCreditNoteItemID,
                       SUM(pmd.[Value]) AS [Value]
                       
                FROM   Pay.ParameterMonthlyData AS pmd
                WHERE  pmd.PaymentSubjectID IS NOT NULL
                       OR  pmd.PettyCashCostItemID IS NOT NULL
                       OR  pmd.DebitCreditNoteItemID IS NOT NULL
                       
                GROUP BY
                       pmd.PersonnelID,
                       PaymentSubjectID,
                       PettyCashCostItemID,
                       DebitCreditNoteItemID
            ) Pm
            ON  pm.PersonnelID = p.PersonelID
            AND
                (
                    (vpd.ItemType = 1 AND pm.PaymentSubjectID = vpd.Id)
                    OR (vpd.ItemType = 2 AND pm.DebitCreditNoteItemID = vpd.Id)
                    OR (vpd.ItemType = 3 AND pm.PettyCashCostItemID = vpd.Id)
                )
