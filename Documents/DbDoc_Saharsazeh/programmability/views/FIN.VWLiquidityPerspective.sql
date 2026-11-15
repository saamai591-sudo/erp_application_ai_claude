    
------------------------------------------------
CREATE    VIEW [FIN].VWLiquidityPerspective
AS
SELECT 'ReceivedCheqe' [Type],
       RC.Date,
       CASE
           WHEN RC.CurrencyID = -1 THEN
               RC.Amount
           ELSE
               ROUND(RC.Amount * CR.Rate / C.ExchangeUnit, CFG.GetBaseCurrencyPrecision())
       END Amount,
       DL.Code DlCode,
       DL.Title DlTitle,
       DL.Title2 DlTitle2,
       B.Code BranchCode,
       B.Title BranchTitle,
       B.Title2 BranchTitle2,
       B.BranchID,
       CAST(RC.Number AS VARCHAR(1024)) Number,
       RR.FinancialPeriodID
FROM FIN.ReceivedCheqe RC
    JOIN FIN.ReceiveReceipt RR
        ON RR.ReceiveReceiptID = RC.ReceiveReceiptID
    JOIN CFG.Branch B
        ON B.BranchID = RR.BranchID
    JOIN FIN.ReceiveSubject RS
        ON RS.ReceivedCheqeID = RC.ReceivedCheqeID
    JOIN ACC.DL
        ON DL.DLID = RS.DLID
    JOIN CFG.Currency C
        ON C.CurrencyID = RC.CurrencyID
    LEFT JOIN
    (
        SELECT ROW_NUMBER() OVER (PARTITION BY CurrencyID ORDER BY Date DESC) Rno,
               CurrencyID,
               Rate
        FROM CFG.CurrencyRate
    ) CR
        ON RC.CurrencyID = CR.CurrencyID
           AND CR.Rno = 1
WHERE LastState IN ( 0, 1 )
      AND
      (
          RC.CurrencyID = -1
          OR CR.CurrencyID IS NOT NULL
      )
UNION ALL
SELECT 'ReceivedInstallment' [Type],
       DATEADD(DAY, I.Usance, I.Date) Date,
       vw.NonReceived Amopunt,
       DL.Code DlCode,
       DL.Title DlTitle,
       DL.Title2 DlTitle2,
       B.Code BranchCode,
       B.Title BranchTitle,
       B.Title2 BranchTitle2,
       B.BranchID,
       CAST(I.Number AS VARCHAR(1024)) Number,
       I.FinancialPeriodID
FROM SLE.Invoice I
    JOIN CFG.Party P
        ON P.PartyID = I.CustomerID
    JOIN ACC.DL
        ON DL.DLID = P.DlID
    JOIN CFG.Branch B
        ON B.BranchID = I.BranchID
    JOIN SLE.Invoice_NonReceived vw
        ON vw.InvoiceID = I.InvoiceID
WHERE vw.NonReceived <> 0
AND i.SaleInvoiceStatus <> 5
UNION ALL
SELECT 'ReceivedInstallment' [Type],
       I.Date,
       vw.remain Amopunt,
       DL.Code DlCode,
       DL.Title DlTitle,
       DL.Title2 DlTitle2,
       B.Code BranchCode,
       B.Title BranchTitle,
       B.Title2 BranchTitle2,
       B.BranchID,
       CAST(I.Number AS VARCHAR(1024)) Number,
       H.FinancialPeriodID
FROM CFG.InstallmentPaymentItem I
    JOIN CFG.InstallmentPayment H
        ON I.InstallmentPaymentID = H.InstallmentPaymentID
    JOIN CFG.Party P
        ON P.PartyID = H.PartyId
    JOIN ACC.DL
        ON DL.DLID = P.DlID
    JOIN CFG.Branch B
        ON B.BranchID = H.BranchId
    LEFT JOIN CFG.vwInstallmentPaymentRemain vw
        ON vw.InstallmentPaymentItemID = I.InstallmentPaymentItemID
WHERE H.InstallmentType = 1
      AND vw.remain <> 0
UNION ALL
SELECT 'PaymentCheqe' [Type],
       PC.Date,
       -1 * CASE
                WHEN PC.CurrencyID = -1 THEN
                    PC.Amount
                ELSE
                    ROUND(PC.Amount * CR.Rate / C.ExchangeUnit, CFG.GetBaseCurrencyPrecision())
            END Amount,
       DL.Code DlCode,
       DL.Title DlTitle,
       DL.Title2 DlTitle2,
       B.Code BranchCode,
       B.Title BranchTitle,
       B.Title2 BranchTitle2,
       B.BranchID,
       CAST(PC.Number AS VARCHAR(1024)) Number,
       PR.FinancialPeriodID
FROM FIN.PaymentCheqe PC
    JOIN FIN.PaymentReceipt PR
        ON PR.PaymentReceiptID = PC.PaymentReceiptID
    JOIN CFG.Branch B
        ON B.BranchID = PR.BranchID
    JOIN FIN.PaymentSubject PS
        ON PS.PaymentCheqeID = PC.PaymentCheqeID
    JOIN ACC.DL
        ON DL.DLID = PS.DLID
    JOIN CFG.Currency C
        ON C.CurrencyID = PC.CurrencyID
    LEFT JOIN
    (
        SELECT ROW_NUMBER() OVER (PARTITION BY CurrencyID ORDER BY Date DESC) Rno,
               CurrencyID,
               Rate
        FROM CFG.CurrencyRate
    ) CR
        ON PC.CurrencyID = CR.CurrencyID
           AND CR.Rno = 1
WHERE PC.LastState = 1
      AND
      (
          PC.CurrencyID = -1
          OR CR.CurrencyID IS NOT NULL
      )
	  AND pr.Status <> 2
UNION ALL
SELECT 'PaymentInstallment' [Type],
       I.Date,
       -1 * vw.remain Amount,
       DL.Code DlCode,
       DL.Title DlTitle,
       DL.Title2 DlTitle2,
       B.Code BranchCode,
       B.Title BranchTitle,
       B.Title2 BranchTitle2,
       B.BranchID,
       CAST(I.Number AS VARCHAR(1024)) Number,
       H.FinancialPeriodID
FROM CFG.InstallmentPaymentItem I
    JOIN CFG.InstallmentPayment H
        ON I.InstallmentPaymentID = H.InstallmentPaymentID
    JOIN CFG.Party P
        ON P.PartyID = H.PartyId
    JOIN ACC.DL
        ON DL.DLID = P.DlID
    JOIN CFG.Branch B
        ON B.BranchID = H.BranchId
    LEFT JOIN CFG.vwInstallmentPaymentRemain vw
        ON vw.InstallmentPaymentItemID = I.InstallmentPaymentItemID
WHERE H.InstallmentType = 2
      AND vw.remain <> 0;

