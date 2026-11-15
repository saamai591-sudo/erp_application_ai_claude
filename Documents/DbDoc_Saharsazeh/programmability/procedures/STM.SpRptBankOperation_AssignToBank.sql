
----------------------------------------------------------------------------
CREATE   PROC [STM].[SpRptBankOperation_AssignToBank]
@ReceiptCheqeFlowID NVARCHAR(MAX)
--WITH ENCRYPTION 
AS
CREATE TABLE #Ids
(
	id INT
)

INSERT INTO #Ids
SELECT [value]
FROM   cfg.R_FnCommaStr2Table(@ReceiptCheqeFlowID)
---------------------------------------------------------------------------------------------------------
DECLARE @IsBranchInstalled BIT

SELECT @IsBranchInstalled = li.LicenceValue
FROM   cfg.LicenceInfo AS li
 
SELECT a.ReceiptCheqeFlowID,
       CASE w.Type
            WHEN 1 THEN w.Title
            WHEN 0 THEN w.Title + ' ' + w.LastName
       END                 DeliverName,
       a.Number,
       CASE 
            WHEN @IsBranchInstalled = 1 THEN br.Title
            ELSE ''
       END                 BranchTitle,
       a.InnerNumber,
       CFG.GetSaturnDate(a.Date, 0)[Date],
       CASE 
            WHEN a.Type = 0 OR a.Type = 7 THEN 'اعلامیه واگذاری چک به بانک'
       END                 OperationType,
       CASE b.State
            WHEN 1 THEN 'واگذار به بانک'
       END                 CollectionType,
       b.RowIndex,
       c.Number            CheqeNumber,
       CFG.GetSaturnDate(c.Date, 0)[CheqeDate],
       u.name           AS creatorname,
       CASE 
            WHEN a.BankAccountID IS NOT NULL THEN dl.Title
            ELSE sDl.Title
       END                 BankTitle,
       c.Amount            CheqeAmount,
       b2.Title ChequeBank,
	   c.ReceivedCheqeID
FROM   FIN.ReceiptCheqeFlow a
       JOIN FIN.ReceiptCheqeFlowItem b
            ON  a.ReceiptCheqeFlowID = b.ReceiptCheqeFlowID
       JOIN fin.ReceivedCheqe c
            ON  c.ReceivedCheqeID = b.ReceivedCheqeID
       JOIN cfg.Branch  AS br
            ON  br.BranchID = a.BranchID
       JOIN FIN.ReceiveReceipt r
            ON  r.ReceiveReceiptID = c.ReceiveReceiptID
       JOIN CFG.Party w
            ON  w.PartyID = r.PartyID
       LEFT JOIN cfg.BankAccount Ba
            ON  Ba.BankAccountID = a.BankAccountID
       LEFT JOIN ACC.DL dl
            ON  dl.DLID = Ba.DlID
       LEFT JOIN CFG.BankAccount d
            ON  d.BankAccountID = a.BankAccountID
                -----------    برای نشان دادن حساب بانکی در فرم وصول و واخواست-----------
       LEFT JOIN FIN.ReceiptCheqeFlowItem ri
            ON  b.PreviousFlow = ri.ReceiptCheqeFlowItemID
            AND (b.State = 6 OR b.State = 7)
       LEFT JOIN FIN.ReceiptCheqeFlow rcf
            ON  rcf.ReceiptCheqeFlowID = ri.ReceiptCheqeFlowID
       LEFT JOIN CFG.BankAccount sBa
            ON  sBa.BankAccountID = rcf.BankAccountID
       LEFT JOIN Acc.DL sDl
            ON  sDl.DLID = sBa.DlID
       JOIN cfg.[User] u
            ON  u.UserID = a.Creator
            
       LEFT JOIN cfg.Bank AS b2 ON c.BankID = b2.BankID     
WHERE  a.ReceiptCheqeFlowID IN (SELECT id
                                FROM   #Ids)
       AND a.Type IN (0, 7, 10);
