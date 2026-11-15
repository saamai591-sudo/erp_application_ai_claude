CREATE VIEW [FIN].[vwPartyDebit]
AS 

SELECT ps.PaymentSubjectID            AS Id,
       1                              AS ItemType,
       N'موضوع پرداخت ' + ' - ' + CAST(pr.Number AS NVARCHAR(512)) + ' - ' + CAST(ps.RowIndex AS NVARCHAR(512)) AS Title,
       p.PartyID,
       ps.Amount,
       pr.[Date],
       ps.PaymentTypeID,
       pr.BranchID,
       ps.CurrencyID
FROM   fin.PaymentSubject             AS ps
       INNER JOIN fin.PaymentReceipt  AS pr
            ON  pr.PaymentReceiptID = ps.PaymentReceiptID
       INNER JOIN acc.DL              AS d
            ON  d.DLID = ps.DLID
       INNER JOIN cfg.Party           AS p
            ON  p.DlID = d.DLID
            
UNION

 
SELECT dcni.DebitCreditNoteItemID,
       2,
       N'اعلامیه بدهکار بستانکار ' + ' - ' + CAST(dcn.Number AS NVARCHAR(512)) 
       + ' - ' + CAST(dcni.RowIndex AS NVARCHAR(512)) AS Title,
       dcni.PartyID,
       dcni.Amount,
       dcn.[Date],
       dcni.PaymentTypeID,
       dcn.BranchID,
       dcni.CurrencyID
FROM   Cfg.DebitCreditNote AS dcn
       INNER JOIN CFG.DebitCreditNoteItem AS dcni
            ON  dcni.DebitCreditNoteID = dcn.DebitCreditNoteID
UNION

       
SELECT pcci.PettyCashCostItemID,
       3,
       N'صورتخلاصه تنخواه  ' + ' - ' + CAST(pcc.Number AS NVARCHAR(512)) 
       + ' - ' + CAST(pcci.RowIndex AS NVARCHAR(512)) AS Title,
       pcci.PartyID,
       pcci.Amount,
       pcc.[Date],
       pcci.PaymentTypeID,
       pcc.BranchID,
       pc.CurrencyID
FROM   Fin.PettyCashCost                 AS pcc
       INNER JOIN FIN.PettyCashCostItem  AS pcci
            ON  pcci.PettyCashCostID = pcc.PettyCashCostID
       INNER JOIN fin.PettyCash          AS pc
            ON  pc.PettyCashID = pcc.PettyCashID 
