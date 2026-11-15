
-------------------------------------
CREATE   PROCEDURE [FIN].SpRptFinance_BankAccount
(@FromDate DATE = null, @ToDate DATE = null) 
--WITH ENCRYPTION
AS
BEGIN
	DECLARE @UserID        INT,
	        @Culture       VARCHAR(25),
	        @CultureNo     TINYINT
	
	SELECT @UserID = CFG.GetuserID()
	SET @Culture = CFG.GetuserCulture();
	
	SELECT @CultureNo = CultureNo
	FROM   CFG.CultureInfo
	WHERE  Culture = @Culture
	
	SELECT BankAccountID,
	       SUM(Amount)           OpeningBalance
	INTO   #BeginningInventory
	FROM   FIN.vwbankaccount     a
	WHERE  DATE < @FromDate
	GROUP BY
	       BankAccountID
	
	
	SELECT a.BankAccountID,
	       SUM(a.Amount)         Receives
	INTO   #Receipt
	FROM   FIN.vwbankaccount     a
	WHERE  DATE BETWEEN @FromDate AND @ToDate
	       AND a.Amount > 0
	GROUP BY
	       BankAccountID
	
	SELECT BankAccountID,
	       SUM(Amount)           Payments
	INTO   #Payment
	FROM   FIN.vwbankaccount     a
	WHERE  DATE BETWEEN @FromDate AND @ToDate
	       AND Amount < 0
	GROUP BY
	       BankAccountID
	
	SELECT f.BankAccountID,
	       SUM(c.Amount) Amount
	INTO   #AssignToBanks
	FROM   FIN.ReceiptCheqeFlowItem i
	       JOIN FIN.ReceiptCheqeFlow f
	            ON  i.ReceiptCheqeFlowID = f.ReceiptCheqeFlowID
	       JOIN FIN.ReceivedCheqe c
	            ON  i.ReceiptCheqeFlowItemID = c.LastFlow
	WHERE  c.LastState = 1
	       AND i.[State] = 1-- and c.[Date] BETWEEN @FromDate AND @ToDate
	GROUP BY
	       f.BankAccountID
	
	SELECT pc.BankAccountID,
	       SUM(-pc.Amount)             Amount
	INTO   #payables
	FROM   FIN.PaymentCheqe pc
	       JOIN FIN.PaymentReceipt  AS pr
	            ON  pr.PaymentReceiptID = pc.PaymentReceiptID
	       JOIN FIN.PaymentCheqeType t
	            ON  pc.PaymentCheqeTypeID = t.PaymentCheqeTypeID
	WHERE  t.Today = 0
	       AND pc.LastState = 1 --and pc.[Date] BETWEEN @FromDate AND @ToDate
	       AND pr.[Status] <> 2
	GROUP BY
	       pc.BankAccountID
	
	SELECT SUM(pm.Price * pm.ExchangeRate) AS PaymentOrderAmount,
	       po.BankAccountID
	INTO   #PaymentOrder
	FROM   REQ.PaymentOrder po
	       left JOIN FIN.PaymentReceipt pr
	            ON  pr.PaymentOrderID = po.PaymentOrderID
	       JOIN REQ.PaymentOrderItem pm
	            ON  pm.PaymentOrderID = po.PaymentOrderID
	WHERE  pr.PaymentOrderID IS null
	       AND po.PaymentOrderStatus NOT IN (4, 5)
	GROUP BY
	       po.BankAccountID
	
	SELECT p.BankAccountID,
	       SUM(p.Amount)           Amount
	INTO   #PettyCash_OpeningBalance
	FROM   [FIN].[VWPettyCash]     p
	WHERE  (p.Date IS NULL OR p.Date < @FromDate)
	GROUP BY
	       p.BankAccountID;
	
	SELECT vpc.BankAccountID,
	       SUM(Amount) Amount
	INTO   #PettyCash_Receive
	FROM   [FIN].[VWPettyCash] vpc
	       JOIN CFG.vwFinancialPeriodAccess AS vfpa
	            ON  vfpa.FinancialPeriodID = vpc.FinancialPeriodID
	WHERE  vpc.Date
	       BETWEEN @FromDate AND @ToDate
	       AND Amount > 0
	GROUP BY
	       vpc.BankAccountID;
	
	SELECT vpc.BankAccountID,
	       SUM(vpc.Amount) Amount
	INTO   #PettyCash_Payment
	FROM   [FIN].[VWPettyCash] vpc
	       JOIN CFG.vwFinancialPeriodAccess AS vfpa
	            ON  vfpa.FinancialPeriodID = vpc.FinancialPeriodID
	WHERE  vpc.Date
	       BETWEEN @FromDate AND @ToDate
	       AND vpc.Amount < 0
	GROUP BY
	       vpc.BankAccountID;
	
	SELECT *
	INTO   #vwBankAccountAccess
	FROM   cfg.vwBankAccountAccess AS vbaa
	
	SELECT ba.BankAccountID,
	       d.Code,
	       CASE 
	            WHEN @CultureNo = 1 THEN d.Title
	            WHEN @CultureNo = 2 THEN d.Title2
	       END                           AS Title,
	       ba.CurrencyID,
	       CASE 
	            WHEN @CultureNo = 1 THEN cu.Title
	            WHEN @CultureNo = 2 THEN cu.Title2
	       END                           AS CurrencyTitle,
	       ISNULL(bi.OpeningBalance, 0)     OpeningBalance,
	       ISNULL(r.Receives, 0)            Received,
	       ISNULL(p.Payments, 0)            Payment,
	       ISNULL(bi.OpeningBalance, 0) + ISNULL(r.Receives, 0) + ISNULL(p.Payments, 0) Amount,
	       ISNULL(AssignToBanks.Amount, 0) AssignToBankCheqeAmount,
	       ISNULL(payables.Amount, 0)       TermCheqeAmount,
	       ISNULL(payment.PaymentOrderAmount, 0) AS PaymentOrderAmount,
	       ISNULL(a.Amount, 0)              PettyCashOpeningBalance,
	       ISNULL(b.Amount, 0)              PettyCashReceived,
	       ISNULL(c.Amount, 0)              PettyCashPayment,
	       ISNULL(a.Amount, 0) + ISNULL(b.Amount, 0) + ISNULL(c.Amount, 0) PettyCashAmount
	FROM   CFG.BankAccount ba
	       JOIN ACC.DL d
	            ON  ba.DlID = d.DLID
	       JOIN CFG.Currency cu
	            ON  ba.CurrencyID = cu.CurrencyID
	       JOIN #vwBankAccountAccess     AS vbaa
	            ON  vbaa.BankAccountID = ba.BankAccountID
	       LEFT JOIN #BeginningInventory bi
	            ON  ba.BankAccountID = bi.BankAccountID
	       LEFT JOIN #Receipt r
	            ON  ba.BankAccountID = r.BankAccountID
	       LEFT JOIN #Payment P
	            ON  ba.BankAccountID = p.BankAccountID
	       LEFT JOIN #AssignToBanks      AssignToBanks
	            ON  ba.BankAccountID = AssignToBanks.BankAccountID
	       LEFT JOIN #payables payables
	            ON  ba.BankAccountID = payables.BankAccountID
	       LEFT JOIN #PaymentOrder       AS payment
	            ON  ba.BankAccountID = payment.BankAccountID
	       LEFT JOIN #PettyCash_OpeningBalance a
	            ON  ba.BankAccountID = a.BankAccountID
	       LEFT JOIN #PettyCash_Receive b
	            ON  ba.BankAccountID = b.BankAccountID
	       LEFT JOIN #PettyCash_Payment c
	            ON  ba.BankAccountID = c.BankAccountID
	WHERE  ISNULL(ISNULL(ISNULL(ISNULL(ISNULL(
	           ISNULL(
	               ISNULL(
	                   ISNULL(
	                       ISNULL(vbaa.BankAccountID, bi.BankAccountID),
	                       r.BankAccountID
	                   ),
	                   p.BankAccountID
	               ),
	               AssignToBanks.BankAccountID
	           ),
	           payables.BankAccountID
	       ),payment.BankAccountID),a.BankAccountID),b.BankAccountID),c.BankAccountID) is NOT null
END
