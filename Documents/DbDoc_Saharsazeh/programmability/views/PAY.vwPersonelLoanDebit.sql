

/************************************************************
 * Code formatted by SoftTree SQL Assistant © v9.5.444
 * Time: 3/17/2019 2:20:17 PM
 ************************************************************/

CREATE VIEW [PAY].[vwPersonelLoanDebit]
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
       p.PersonelId,
       vpd.Amount -IsNull(pm.TotalAmount,0)  AS RemainValue,
       ParameterTitle,
       ParameterID
FROM   fin.vwPartyDebit            AS vpd
       INNER JOIN hrm.Personel     AS p
            ON  p.PartyID = vpd.PartyID
         INNER JOIN (
         	SELECT p2.ParameterID,p2.PaymentTypeID,p2.Title AS ParameterTitle
                             FROM   pay.Parameter AS p2
                             WHERE  p2.CategoryID = 7
                             AND p2.PaymentTypeID IS NOT null
         ) p2
         ON p2.PaymentTypeID=vpd.PaymentTypeID
       LEFT JOIN (
                SELECT l.PersonelID,
                       PaymentSubjectID,
                       PettyCashCostItemID,
                       DebitCreditNoteItemID,
                       SUM(l.TotalAmount) AS TotalAmount
                FROM   Pay.Loan AS l
                WHERE  (
                           PaymentSubjectID IS NOT NULL
                           OR PettyCashCostItemID IS NOT NULL
                           OR DebitCreditNoteItemID IS NOT NULL
                       )
                       AND l.ParentID IS NULL
                GROUP BY
                       l.PersonelID,
                       PaymentSubjectID,
                       PettyCashCostItemID,
                       DebitCreditNoteItemID
            ) Pm
            ON  pm.PersonelID = p.PersonelID
            AND (
                    (vpd.ItemType = 1 AND pm.PaymentSubjectID = vpd.Id)
                    OR (vpd.ItemType = 2 AND pm.DebitCreditNoteItemID = vpd.Id)
                    OR (vpd.ItemType = 3 AND pm.PettyCashCostItemID = vpd.Id)
                )

