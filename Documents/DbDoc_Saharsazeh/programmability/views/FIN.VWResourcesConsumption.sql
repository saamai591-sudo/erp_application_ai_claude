
--------------Start of #7675
CREATE   VIEW [FIN].VWResourcesConsumption
AS
--چکهای پاس شده
SELECT 'Cheque' DocumentType,
       RCFI.ReceiptCheqeFlowID DocumentID,
       CASE
           WHEN RCFI.State IN ( 3, 4 ) THEN
               'ReceivedCheqeCashing'
           WHEN RCFI.State = 6 THEN
               'BankOperation'
       END DocumentEngName,
       RCF.Date,
	   ISNULL(ROUND(CASE
                WHEN C2.IsBaseCurrencyBasis = 0 THEN
                    RS.Amount * RS.CurrencyRate / NULLIF(C2.ExchangeUnit, 0)
                ELSE
                    RS.Amount * C2.ExchangeUnit / NULLIF(RS.CurrencyRate, 0)
            END,cfg.GetBaseCurrencyPrecision()), 0) AmountInBaseCurrency,
	   RS.Amount,
       RC.CurrencyID,
       DL.Code DlCode,
       DL.Title DlTitle,
       DL.Title2 DlTitle2,
       RCF.BranchID,
       CASE
           WHEN RCFI.State IN ( 3, 4 ) THEN
               dl1.Title
           WHEN RCFI.State = 6 THEN
               dl2.Title
       END BankOrCashTitle,
       CASE
           WHEN RCFI.State IN ( 3, 4 ) THEN
               dl1.Title2
           WHEN RCFI.State = 6 THEN
               dl2.Title2
       END BankOrCashTitle2,
       'Receive' Type,
       RS.ReceiveSubjectID SubjectID,
       RT.ReceiptTypeID SubjectTypeID,
       rst.[Value] SubjectType,
       RT.Title SubjectTitle,
       RT.Title2 SubjectTitle2,
       RCF.FinancialPeriodID,
       RS.Description,
       RS.Description2,
	   rt.CashStructureID,
       case when rcfi.State = 3 then rcf.CashID  end CashID,
       case when rcfi.State = 4 then rcf.BankAccountID
            when rcfi.state = 6 then rcf2.BankAccountID 
            end BankAccountID,
       NULL PettyCashID
FROM FIN.ReceiptCheqeFlowItem RCFI
JOIN FIN.ReceiptCheqeFlow RCF
    ON RCF.ReceiptCheqeFlowID = RCFI.ReceiptCheqeFlowID
JOIN FIN.ReceivedCheqe RC
    ON RC.ReceivedCheqeID = RCFI.ReceivedCheqeID
JOIN FIN.ReceiveSubject RS
    ON RS.ReceivedCheqeID = RC.ReceivedCheqeID
JOIN FIN.ReceiptType RT
    ON RT.ReceiptTypeID = RS.ReceiptTypeID
LEFT JOIN CFG.VwEnums rst
	ON rst.KeyValue = RT.[Type] AND rst.Enum = 'ReceiptSubjectTypes'
LEFT JOIN ACC.DL AS dl
    ON DL.DLID = RS.DLID
JOIN CFG.Currency C2
    ON C2.CurrencyID = RS.CurrencyID
LEFT JOIN CFG.BankAccount BA1
    ON BA1.BankAccountID = RCF.BankAccountID
LEFT JOIN ACC.DL dl1
    ON dl1.DLID = BA1.DlID
LEFT JOIN FIN.ReceiptCheqeFlowItem RCFI2
    ON RCFI2.ReceiptCheqeFlowItemID = RCFI.PreviousFlow
LEFT JOIN FIN.ReceiptCheqeFlow RCF2
    ON RCF2.ReceiptCheqeFlowID = RCFI2.ReceiptCheqeFlowID
LEFT JOIN CFG.BankAccount BA2
    ON BA2.BankAccountID = RCF2.BankAccountID
LEFT JOIN ACC.DL dl2
    ON dl2.DLID = BA2.DlID
WHERE RCFI.State IN ( 3, 4, 6 )
      AND RT.Type NOT IN ( 5, 8 )
UNION ALL
--واریزها
SELECT 'ReceivedBankDraft' DocumentType,
       RB.ReceiveReceiptID DocumentID,
       'ReceiveReceipt' DocumentEngName,
       RB.Date,
	   ISNULL(ROUND(CASE
                WHEN C2.IsBaseCurrencyBasis = 0 THEN
                    RS.Amount * RS.CurrencyRate / NULLIF(C2.ExchangeUnit, 0)
                ELSE
                    RS.Amount * C2.ExchangeUnit / NULLIF(RS.CurrencyRate, 0)
            END,cfg.GetBaseCurrencyPrecision()), 0) AmountInBaseCurrency,
	   RS.Amount,
       RB.CurrencyID,
       DL.Code DlCode,
       DL.Title DlTitle,
       DL.Title2 DlTitle2,
       RR.BranchID,
       dl1.Title BankOrCashTitle,
       dl1.Title2 BankOrCashTitle2,
       'Receive' Type,
       RS.ReceiveSubjectID SubjectID,
       RT.ReceiptTypeID SubjectTypeID,
       rst.Value SubjectType,
       RT.Title SubjectTitle,
       RT.Title2 SubjectTitle2,
       RR.FinancialPeriodID,
       RS.Description,
       RS.Description2,
	   rt.CashStructureID,
       Null CashID,
       rb.BankAccountID,
       NULL PettyCashID
FROM FIN.ReceivedBankDraft RB
JOIN FIN.ReceiveReceipt RR
    ON RR.ReceiveReceiptID = RB.ReceiveReceiptID
JOIN FIN.ReceiveSubject RS
    ON RS.ReceivedBankDraftID = RB.ReceivedBankDraftID
JOIN FIN.ReceiptType RT
    ON RT.ReceiptTypeID = RS.ReceiptTypeID
LEFT JOIN CFG.VwEnums rst
	ON rst.KeyValue = RT.[Type] AND Enum = 'ReceiptSubjectTypes'
LEFT JOIN ACC.DL AS dl
    ON DL.DLID = RS.DLID
JOIN CFG.Currency C2
    ON C2.CurrencyID = RS.CurrencyID
JOIN CFG.BankAccount BA
    ON BA.BankAccountID = RB.BankAccountID
JOIN ACC.DL dl1
    ON dl1.DLID = BA.DlID
WHERE RT.Type NOT IN ( 5, 8 )
UNION ALL
-- دریافتهای نقدی
SELECT 'Cash' DocumentType,
       RC.ReceiveReceiptID DocumentID,
       'ReceiveReceipt' DocumentEngName,
       RR.Date,
	   ISNULL(ROUND(CASE
                WHEN C2.IsBaseCurrencyBasis = 0 THEN
                    RS.Amount * RS.CurrencyRate / NULLIF(C2.ExchangeUnit, 0)
                ELSE
                    RS.Amount * C2.ExchangeUnit / NULLIF(RS.CurrencyRate, 0)
            END,cfg.GetBaseCurrencyPrecision()), 0) AmountInBaseCurrency,
	   RS.Amount,
       RC.CurrencyID,
       DL.Code DlCode,
       DL.Title DlTitle,
       DL.Title2 DlTitle2,
       RR.BranchID,
       ca.Title BankOrCashTitle,
       ca.Title2 BankOrCashTitle2,
       'Receive' Type,
       RS.ReceiveSubjectID SubjectID,
       RT.ReceiptTypeID SubjectTypeID,
       RsT.[Value] SubjectType,
       RT.Title SubjectTitle,
       RT.Title2 SubjectTitle2,
       RR.FinancialPeriodID,
       RS.Description,
       RS.Description2,
	   rt.CashStructureID,
       rc.CashID,
       Null BankAccountID,
       NULL PettyCashID
FROM FIN.ReceivedCash RC
JOIN FIN.ReceiveReceipt RR
    ON RR.ReceiveReceiptID = RC.ReceiveReceiptID
JOIN FIN.ReceiveSubject RS
    ON RS.ReceivedCashID = RC.ReceivedCashID
JOIN FIN.ReceiptType RT
    ON RT.ReceiptTypeID = RS.ReceiptTypeID
LEFT JOIN CFG.VwEnums rst
	ON rst.KeyValue = RT.[Type] AND Enum = 'ReceiptSubjectTypes'
LEFT JOIN ACC.DL AS dl
    ON DL.DLID = RS.DLID
JOIN CFG.Currency C2
    ON C2.CurrencyID = RS.CurrencyID
JOIN CFG.Cash ca
    ON ca.CashID = RC.CashID
WHERE RT.Type NOT IN ( 5, 8 )
UNION ALL
--چک روز
SELECT 'Cheque' DocumentType,
       PC.PaymentReceiptID DocumentID,
       'PaymentReceipt' DocumentEngName,
       PC.Date,
	   -1 * ISNULL(ROUND(CASE
                WHEN C2.IsBaseCurrencyBasis = 0 THEN
                    PS.Amount * PS.CurrencyRate / NULLIF(C2.ExchangeUnit, 0)
                ELSE
                    PS.Amount * C2.ExchangeUnit / NULLIF(PS.CurrencyRate, 0)
            END,cfg.GetBaseCurrencyPrecision()), 0) AmountInBaseCurrency,
	   -1 *  PS.Amount,
       PC.CurrencyID,
       DL.Code DlCode,
       DL.Title DlTitle,
       DL.Title2 DlTitle2,
       PR.BranchID,
       dl1.Title BankOrCashTitle,
       dl1.Title2 BankOrCashTitle2,
       'Payment' Type,
       PS.PaymentSubjectID SubjectID,
       PT.PaymentTypeID SubjectTypeID,
       pst.Value SubjectType,
       PT.Title SubjectTitle,
       PT.Title2 SubjectTitle2,
       PR.FinancialPeriodID,
       PS.Description,
       PS.Description2,
	   pt.CashStructureID,
       null CashID,
       pc.BankAccountID,
       NULL PettyCashID
FROM FIN.PaymentCheqe PC
    JOIN FIN.PaymentReceipt PR
        ON PR.PaymentReceiptID = PC.PaymentReceiptID
    JOIN FIN.PaymentSubject PS
        ON PC.PaymentCheqeID = PS.PaymentCheqeID
    JOIN FIN.PaymentType PT
        ON PT.PaymentTypeID = PS.PaymentTypeID
    LEFT JOIN  CFG.VwEnums pst
		ON  pst.KeyValue = PT.Type  AND Enum = 'PaymentSubjectTypes'
    JOIN FIN.PaymentCheqeType PCT
        ON PC.PaymentCheqeTypeID = PCT.PaymentCheqeTypeID
    LEFT JOIN ACC.DL AS dl
        ON DL.DLID = PS.DLID
    JOIN CFG.Currency C2
        ON C2.CurrencyID = PS.CurrencyID
    JOIN CFG.BankAccount BA
        ON BA.BankAccountID = PC.BankAccountID
    JOIN ACC.DL dl1
        ON dl1.DLID = BA.DlID
WHERE PCT.Today = 1
      AND PT.Type NOT IN ( 4, 5, 6 )
      AND PR.Status <> 2
UNION ALL
--چک نقد شده
SELECT 'Cheque' DocumentType,
       PCFI.PaymentCheqeFlowID DocumentID,
       'PaymentCheqeCashing' DocumentEngName,
       PCF.Date,
	   -1 * ISNULL(ROUND(CASE
                WHEN C2.IsBaseCurrencyBasis = 0 THEN
                    PS.Amount * PS.CurrencyRate / NULLIF(C2.ExchangeUnit, 0)
                ELSE
                    PS.Amount * C2.ExchangeUnit / NULLIF(PS.CurrencyRate, 0)
            END,cfg.GetBaseCurrencyPrecision()), 0) AmountInBaseCurrency,
	   -1 *  PS.Amount,
       PC.CurrencyID,
       DL.Code DlCode,
       DL.Title DlTitle,
       DL.Title2 DlTitle2,
       PCF.BranchID,
       dl1.Title BankOrCashTitle,
       dl1.Title2 BankOrCashTitle2,
       'Payment' Type,
       PS.PaymentSubjectID SubjectID,
       PT.PaymentTypeID SubjectTypeID,
       pst.Value SubjectType,
       PT.Title SubjectTitle,
       PT.Title2 SubjectTitle2,
       PCF.FinancialPeriodID,
       PS.Description,
       PS.Description2,
	   pt.CashStructureID,
       NULL CashID,
       pc.BankAccountID,
       NULL PettyCashID
FROM FIN.PaymentCheqeFlowItem PCFI
    JOIN FIN.PaymentCheqeFlow PCF
        ON PCFI.PaymentCheqeFlowID = PCF.PaymentCheqeFlowID
    JOIN FIN.PaymentCheqe PC
        ON PCFI.PaymentCheqeID = PC.PaymentCheqeID
    JOIN FIN.PaymentSubject PS
        ON PC.PaymentCheqeID = PS.PaymentCheqeID
    JOIN FIN.PaymentType PT
        ON PT.PaymentTypeID = PS.PaymentTypeID
    LEFT JOIN  CFG.VwEnums pst
		ON  pst.KeyValue = PT.Type AND Enum = 'PaymentSubjectTypes'
    JOIN FIN.PaymentCheqeType PCT
        ON PC.PaymentCheqeTypeID = PCT.PaymentCheqeTypeID
    LEFT JOIN ACC.DL AS dl
        ON DL.DLID = PS.DLID
    JOIN CFG.Currency C2
        ON C2.CurrencyID = PS.CurrencyID
    JOIN CFG.BankAccount BA
        ON BA.BankAccountID = PC.BankAccountID
    JOIN ACC.DL dl1
        ON dl1.DLID = BA.DlID
WHERE PCF.Type = 0
      AND PT.Type NOT IN ( 4, 5, 6 )
UNION ALL
-- برداشتها
SELECT 'PaymentBankDraft' DocumentType,
       PB.PaymentReceiptID DocumentID,
       'PaymentReceipt' DocumentEngName,
       PB.Date,
	   -1 * ISNULL(ROUND(CASE
                WHEN C2.IsBaseCurrencyBasis = 0 THEN
                    PS.Amount * PS.CurrencyRate / NULLIF(C2.ExchangeUnit, 0)
                ELSE
                    PS.Amount * C2.ExchangeUnit / NULLIF(PS.CurrencyRate, 0)
            END,cfg.GetBaseCurrencyPrecision()), 0) AmountInBaseCurrency,
	   -1 *  PS.Amount,
       PB.CurrencyID,
       DL.Code DlCode,
       DL.Title DlTitle,
       DL.Title2 DlTitle2,
       PR.BranchID,
       dl1.Title BankOrCashTitle,
       dl1.Title2 BankOrCashTitle2,
       'Payment' Type,
       PS.PaymentSubjectID SubjectID,
       PT.PaymentTypeID SubjectTypeID,
       pst.Value SubjectType,
       PT.Title SubjectTitle,
       PT.Title2 SubjectTitle2,
       PR.FinancialPeriodID,
       PS.Description,
       PS.Description2,
	   pt.CashStructureID,
       NULL CashID,
       pb.BankAccountID,
       NULL PettyCashID
FROM FIN.PaymentBankDraft PB
    JOIN FIN.PaymentReceipt PR
        ON PR.PaymentReceiptID = PB.PaymentReceiptID
    JOIN FIN.PaymentSubject PS
        ON PS.PaymentBankDraftID = PB.PaymentBankDraftID
    JOIN FIN.PaymentType PT
        ON PT.PaymentTypeID = PS.PaymentTypeID
    LEFT JOIN  CFG.VwEnums pst
		ON  pst.KeyValue = PT.Type  AND Enum = 'PaymentSubjectTypes'
    LEFT JOIN ACC.DL AS dl
        ON DL.DLID = PS.DLID
    JOIN CFG.Currency C2
        ON C2.CurrencyID = PS.CurrencyID
    JOIN CFG.BankAccount BA
        ON BA.BankAccountID = PB.BankAccountID
    JOIN ACC.DL dl1
        ON dl1.DLID = BA.DlID
WHERE PT.Type NOT IN ( 4, 5, 6 )
      AND PR.Status <> 2
UNION ALL
-- پرداختهای نقدی
SELECT 'Cash' DocumentType,
       PC.PaymentReceiptID DocumentID,
       'PaymentReceipt' DocumentEngName,
       PR.Date,
	   -1 * ISNULL(ROUND(CASE
                WHEN C2.IsBaseCurrencyBasis = 0 THEN
                    PS.Amount * PS.CurrencyRate / NULLIF(C2.ExchangeUnit, 0)
                ELSE
                    PS.Amount * C2.ExchangeUnit / NULLIF(PS.CurrencyRate, 0)
            END,cfg.GetBaseCurrencyPrecision()), 0) AmountInBaseCurrency,
	   -1 *  PS.Amount,
       PC.CurrencyID,
       DL.Code DlCode,
       DL.Title DlTitle,
       DL.Title2 DlTitle2,
       PR.BranchID,
       ca.Title BankOrCashTitle,
       ca.Title2 BankOrCashTitle2,
       'Payment' Type,
       PS.PaymentSubjectID SubjectID,
       PT.PaymentTypeID SubjectTypeID,
       pst.Value SubjectType,
       PT.Title SubjectTitle,
       PT.Title2 SubjectTitle2,
       PR.FinancialPeriodID,
       PS.Description,
       PS.Description2,
	   pt.CashStructureID,
       pc.CashID,
       Null BankAccountID,
       NULL PettyCashID
FROM FIN.PaymentCash PC
    JOIN FIN.PaymentReceipt PR
        ON PR.PaymentReceiptID = PC.PaymentReceiptID
    JOIN FIN.PaymentSubject PS
        ON PS.PaymentCashID = PC.PaymentCashID
    JOIN FIN.PaymentType PT
        ON PT.PaymentTypeID = PS.PaymentTypeID
    LEFT JOIN  CFG.VwEnums pst
		ON  pst.KeyValue = PT.Type AND Enum = 'PaymentSubjectTypes'
    LEFT JOIN ACC.DL AS dl
        ON DL.DLID = PS.DLID
    JOIN CFG.Currency C2
        ON C2.CurrencyID = PS.CurrencyID
    JOIN CFG.Cash ca
        ON ca.CashID = PC.CashID
WHERE PT.Type NOT IN ( 4, 5, 6 )
      AND PR.Status <> 2
UNION ALL
-- صورتخلاصه تنخواه
SELECT 'PettyCashCost' DocumentType,
       PS.PettyCashCostID DocumentID,
       'PettyCashCost' DocumentEngName,
       PS.[Date],
	   -1 * ISNULL(ROUND(CASE
                WHEN C.IsBaseCurrencyBasis = 0 THEN
                    PS.Amount * PR.CurrencyRate / NULLIF(C.ExchangeUnit, 0)
                ELSE
                    PS.Amount * C.ExchangeUnit / NULLIF(PR.CurrencyRate, 0)
            END,cfg.GetBaseCurrencyPrecision()), 0) AmountInBaseCurrency,
	   -1 *  PS.Amount,
       pc.[CurrencyID],
       DL.Code DlCode,
       DL.Title DlTitle,
       DL.Title2 DlTitle2,
       PR.BranchID,
       f.Title BankOrCashTitle,
       f.Title2 BankOrCashTitle2,
       'Payment' Type,
       NULL SubjectID,
       PT.PaymentTypeID SubjectTypeID,
       pst.Value SubjectType,
       PT.Title SubjectTitle,
       PT.Title2 SubjectTitle2,
       PR.FinancialPeriodID,
       PS.Description,
       PS.Description2,
	   pt.CashStructureID,
       Null CashID,
       Null BankAccountID,
       pr.PettyCashID
FROM FIN.PettyCashCostItem PS
    JOIN FIN.PettyCashCost PR
        ON PR.PettyCashCostID = PS.PettyCashCostID
    JOIN FIN.PettyCash pc
        ON pc.PettyCashID = PR.PettyCashID
	JOIN FIN.Fund AS f ON f.FundId = pc.FundID
    JOIN FIN.PaymentType PT
        ON PS.PaymentTypeID = PT.PaymentTypeID
    LEFT JOIN  CFG.VwEnums pst
		ON  pst.KeyValue = PT.Type  AND Enum = 'PaymentSubjectTypes'
    JOIN CFG.Party p
        ON p.PartyID = PS.PartyID
    JOIN ACC.DL AS dl
        ON DL.DLID = p.DlID
    JOIN CFG.Currency c
        ON c.CurrencyID = pc.CurrencyID
	where PT.Type <> 6
UNION ALL
-- اعلامیه بدهکار بستانکار - دریافت
SELECT 'DebitCreditNote' DocumentType,
       PS.DebitCreditNoteID DocumentID,
       'DebitCreditNote' DocumentEngName,
       PR.[Date],
	   ISNULL(ROUND(CASE
            WHEN C.IsBaseCurrencyBasis = 0 THEN
                PS.Amount * PS.CurrencyRate / NULLIF(C.ExchangeUnit, 0)
            ELSE
                PS.Amount * C.ExchangeUnit / NULLIF(PS.CurrencyRate, 0)
        END,cfg.GetBaseCurrencyPrecision()), 0) AmountInBaseCurrency,
	   PS.Amount,
       PS.[CurrencyID],
       DL.Code DlCode,
       DL.Title DlTitle,
       DL.Title2 DlTitle2,
       PR.BranchID,
       NULL BankOrCashTitle,
       NULL BankOrCashTitle2,
       'Receive' Type,
       PS.ReceiveSubjectID SubjectID,
       isnull(PT.ReceiptTypeID,PT1.PaymentTypeID) SubjectTypeID,
       isnull(rst.Value,pst.Value) SubjectType,
       isnull(PT.Title,PT1.Title) SubjectTitle,
       isnull(PT.Title2,PT1.Title2) SubjectTitle2,
       PR.FinancialPeriodID,
       PS.Description,
       PS.Description2,
	   isnull(pt.CashStructureID,pt1.CashStructureID),
       Null CashID,
       Null BankAccountID,
       Null PettyCashID
FROM CFG.DebitCreditNoteItem PS
    JOIN CFG.DebitCreditNote PR
        ON PR.DebitCreditNoteID = PS.DebitCreditNoteID
    left JOIN FIN.ReceiptType PT
        ON PS.ReceiptTypeID = PT.ReceiptTypeID
    LEFT JOIN  CFG.VwEnums rst
	    ON rst.KeyValue = PT.[Type] AND rst.Enum = 'ReceiptSubjectTypes' 
    left JOIN FIN.PaymentType PT1
        ON PS.PaymentTypeID = PT1.PaymentTypeID
    LEFT JOIN  CFG.VwEnums pst
		ON  pst.KeyValue = PT1.Type  AND pst.Enum = 'PaymentSubjectTypes'
    LEFT JOIN CFG.Party p
        ON p.PartyID = PS.PartyID
    LEFT JOIN ACC.DL AS dl
        ON DL.DLID = p.DlID
    JOIN CFG.Currency c
        ON c.CurrencyID = ps.CurrencyID
where ps.Type = 1
UNION ALL
-- اعلامیه بدهکار بستانکار - پرداخت
SELECT 'DebitCreditNote' DocumentType,
       PS.DebitCreditNoteID DocumentID,
       'DebitCreditNote' DocumentEngName,
       PR.[Date],
	   -1 * ISNULL(ROUND(CASE
            WHEN C.IsBaseCurrencyBasis = 0 THEN
                PS.Amount * PS.CurrencyRate / NULLIF(C.ExchangeUnit, 0)
            ELSE
                PS.Amount * C.ExchangeUnit / NULLIF(PS.CurrencyRate, 0)
        END,cfg.GetBaseCurrencyPrecision()), 0) AmountInBaseCurrency,
	   -1 * PS.Amount,
       PS.[CurrencyID],
       DL.Code DlCode,
       DL.Title DlTitle,
       DL.Title2 DlTitle2,
       PR.BranchID,
       NULL BankOrCashTitle,
       NULL BankOrCashTitle2,
       'Payment' Type,
       PS.PaymentSubjectID SubjectID,
       isnull(PT.ReceiptTypeID,PT1.PaymentTypeID) SubjectTypeID,
       isnull(rst.Value,pst.Value) SubjectType,
       isnull(PT.Title,PT1.Title) SubjectTitle,
       isnull(PT.Title2,PT1.Title2) SubjectTitle2,
       PR.FinancialPeriodID,
       PS.Description,
       PS.Description2,
	   isnull(pt.CashStructureID,pt1.CashStructureID),
       Null CashID,
       Null BankAccountID,
       Null PettyCashID
FROM CFG.DebitCreditNoteItem PS
    JOIN CFG.DebitCreditNote PR
        ON PR.DebitCreditNoteID = PS.DebitCreditNoteID
    left JOIN FIN.ReceiptType PT
        ON PS.ReceiptTypeID = PT.ReceiptTypeID
    LEFT JOIN CFG.VwEnums rst 
	    ON rst.KeyValue = PT.[Type]  AND rst.Enum = 'ReceiptSubjectTypes'
    left JOIN FIN.PaymentType PT1
        ON PS.PaymentTypeID = PT1.PaymentTypeID
    LEFT JOIN CFG.VwEnums pst
		ON  pst.KeyValue = PT1.Type  AND pst.Enum = 'PaymentSubjectTypes'
    LEFT JOIN CFG.Party p
        ON p.PartyID = PS.PartyID
    LEFT JOIN ACC.DL AS dl
        ON DL.DLID = p.DlID
    JOIN CFG.Currency c
        ON c.CurrencyID = ps.CurrencyID
	where isnull(PT1.Type , 0) <> 6
	and ps.Type = 0
	
	UNION ALL
	--دریافتی های فروش فروشگاهی
SELECT 'PosReceipt' DocumentType,
       pri.PosReceiptID DocumentID,
       'PosReceipt' DocumentEngName,
       pr.[Date],
	   ISNULL(ROUND(CASE
                WHEN c.IsBaseCurrencyBasis = 0 THEN
                    pri.Amount * pri.CurrencyRate / NULLIF(c.ExchangeUnit, 0)
                ELSE
                    pri.Amount * c.ExchangeUnit / NULLIF(pri.CurrencyRate, 0)
            END,cfg.GetBaseCurrencyPrecision()), 0) AmountInBaseCurrency,
	   pri.Amount,
       pri.CurrencyID,
       d.Code DlCode,
       d.Title DlTitle,
       d.Title2 DlTitle2,
       s.BranchID,
       ISNULL(c2.Title,ISNULL(cr.Title,d2.Title)) BankOrCashTitle,
       ISNULL(c2.Title2,ISNULL(cr.Title,d2.Title2)) BankOrCashTitle2,
       'Receive' Type,
       s.ReceiptTypeID SubjectID,
       s.ReceiptTypeID SubjectTypeID,
       rst.Value SubjectType,
       RT.Title SubjectTitle,
       RT.Title2 SubjectTitle2,
       pr.FinancialPeriodID,
	   Null as Description,
       Null as Description2,
	   rt.CashStructureID,
       c2.CashID CashID,
       pri.BankAccountID,
       NULL PettyCashID
FROM POS.PosReceiptItem AS pri
join pos.PosReceipt AS pr on pr.PosReceiptID = pri.PosReceiptID
join cfg.Currency AS c on c.CurrencyID = pri.CurrencyID
join cfg.Party AS p on p.PartyID = pr.CustomerID
left join acc.DL AS d on p.DlID = d.DLID
join pos.StationShift AS ss on ss.StationShiftID = pr.StationShiftID
join pos.Station AS s on s.StationID = ss.StationID
left join cfg.BankAccount AS ba on pri.BankAccountID = ba.BankAccountID
left join acc.DL AS d2 on ba.DlID = d2.DLID
left join pos.CardReader AS cr on pri.CardReaderID = cr.CardReaderID
left join cfg.Cash AS c2 on pri.CashID = c2.CashID
left join fin.ReceiptType AS rt on rt.ReceiptTypeID = s.ReceiptTypeID
LEFT JOIN CFG.VwEnums rst
	ON rst.KeyValue = RT.[Type] AND Enum = 'ReceiptSubjectTypes'
WHERE pri.ItemType IN (1/*CardReader*/,2/*Cash*/,6/*Bank*/)
and pri.IsPayed = 0
