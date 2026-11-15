CREATE     proc [STM].[ReconciledBank_DepositeItem]
(
@Reconcilation NVARCHAR(max)
)
--WITH ENCRYPTION 
AS
CREATE TABLE #Ids
(id INT)

insert into #Ids
SELECT [value] FROM   cfg.R_FnCommaStr2Table(@Reconcilation)

declare @FinancialPeriod int,
		@StartDate date,
		@Date date

select @FinancialPeriod = financialPeriodID,
	   @Date = date
 from [FIN].[Reconciliation]
where [ReconciliationID] = @Reconcilation

select @StartDate = StartDate
from cfg.financialPeriod where financialPeriodID = @FinancialPeriod

create table #BookAmount
(
	BankAccountID int,
	Code varchar(50),
	Title nvarchar(500),
	CurrencyID int,	
	CurrencyTitle varchar(50),
	OpeningBalance decimal(30,4),	
	Received decimal(30,4),
	Payment decimal(30,4),
	Amount decimal(30,4),
	AssignToBankCheqeAmount	decimal(30,4),
	TermCheqeAmount	decimal(30,4),
	PaymentOrderAmount 	decimal(36,10)
)

insert into #BookAmount
exec fin.SpRptFinance_BankAccount @StartDate,@Date

	DECLARE @CashToBank              NVARCHAR(100),
	        @CashFromBank            NVARCHAR(100),
	        @Payment                 NVARCHAR(100),
	        @BankDraft               NVARCHAR(100),
	        @TodayCheqe              NVARCHAR(100),
	        @Outgoing                NVARCHAR(100),
	        @TransferToBank          NVARCHAR(100),
	        @PaymentCheqeCashing     NVARCHAR(100),
			@Culture varchar(10)
	
	set @Culture = cfg.GetuserCulture();

	SELECT @CashToBank = lev.[Value]
	FROM   cfg.LocalizeEnum le
	       JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'CheqeStateInReceive'
	       AND le.Item = 'CashToBank'
	       AND lev.Culture = @Culture
	
	SELECT @CashFromBank = lev.[Value]
	FROM   cfg.LocalizeEnum le
	       JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'CheqeStateInReceive'
	       AND le.Item = 'CashFromBank'
	       AND lev.Culture = @Culture
	
	SELECT @BankDraft = lev.[Value]
	FROM   cfg.LocalizeEnum le
	       JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'PaymentMethod'
	       AND le.Item = 'BankDraft'
	       AND lev.Culture = @Culture
	
	SELECT @TodayCheqe = lev.[Value]
	FROM   cfg.LocalizeEnum le
	       JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'CheqeStateInPayment'
	       AND le.Item = 'TodayCheqe'
	       AND lev.Culture = @Culture
	
	SELECT @Outgoing = lev.[Value]
	FROM   cfg.LocalizeEnum le
	       JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'SaleDocumentBases'
	       AND le.Item = 'Outgoing'
	       AND lev.Culture = @Culture
	
	SELECT @TransferToBank = lev.[Value]
	FROM   cfg.LocalizeEnum le
	       JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'Others'
	       AND le.Item = 'TransferToBank'
	       AND lev.Culture = @Culture
	
	SELECT @PaymentCheqeCashing = lev.[Value]
	FROM   cfg.LocalizeEnum le
	       JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'Others'
	       AND le.Item = 'PaymentCheqeCashing'
	       AND lev.Culture = @Culture

select  m.Amount,
		b.Withdraw,
		cfg.GetCLRSaturnDate(r.Date,'YY/MM/DD',0,0) Date,
		r.ReconciliationID,
		dl.Title,
		bb.Amount BankBill,
		b.Type,
		b.Number,
		b.DateString,
		b.Description,
		b.BankBillDescription

 from [FIN].[Reconciliation] r
 join #BookAmount m on m.BankAccountID = r.BankAccountID
 JOIN CFG.BankAccount bc ON bc.BankAccountID=r.BankAccountID
 JOIN ACC.dl dl ON dl.DLID = bc.DlID
 JOIN FIN.BankBill bb ON bb.BankBillID=r.BankBillID
 LEFT JOIN(
		  select ReconciliationID,b2.Withdraw,b2.Number,cfg.GetCLRSaturnDate(b2.Date,'YY/MM/DD',0,0) DateString,1 Type,b.Description,b2.Description BankBillDescription
		  FROM  fin.ReconciledBillItem b
		  join fin.BankBillItem b2 on b.BankBillItemID = b2.BankBillItemID  
		  where   b2.Withdraw>0 and b.Passed = 0

		  union ALL
  
		  SELECT ReconciliationID,b.deposite Withdraw,
		  CASE EntityType
									 WHEN 1 THEN (select top 1 Number from fin.ReceivedBankDraft where ReceivedBankDraftID = b.EntityID)
									 WHEN 2 THEN (select top 1 Number
													from fin.ReceiptCheqeFlowItem rcfi
													join fin.ReceivedCheqe rc on rc.ReceivedCheqeID = rcfi.ReceivedCheqeID
													 where ReceiptCheqeFlowItemID = b.EntityID)
									 WHEN 3 THEN (select top 1 Number
													from fin.ReceiptCheqeFlowItem rcfi
													join fin.ReceivedCheqe rc on rc.ReceivedCheqeID = rcfi.ReceivedCheqeID
													 where ReceiptCheqeFlowItemID = b.EntityID)
									 WHEN 4 THEN (select top 1 pc.Number 
														from fin.PaymentSubject ps
														join fin.PaymentReceipt pr on pr.PaymentReceiptID = ps.PaymentReceiptID
														left join fin.PaymentCheqe pc on pc.PaymentReceiptID = pr.PaymentReceiptID
														where PaymentSubjectid = b.EntityID)
									 WHEN 5 THEN (select top 1 Number   from fin.ReceivedBankDraft where ReceivedBankDraftid = b.EntityID)
									 WHEN 6 THEN (select top 1 Number   from fin.PaymentCheqe where PaymentCheqeid = b.EntityID)
									 WHEN 7 THEN  (select top 1 Number  from fin.PaymentCheqeFlowItem pcfi
															 join fin.PaymentCheqe pc on pc.PaymentCheqeID = pcfi.PaymentCheqeID 
															 where PaymentCheqeFlowItemid = b.EntityID )
									  WHEN 8 THEN bi.Number 
								END Number,
		   CASE EntityType
									 WHEN 1 THEN (select top 1 cfg.GetCLRSaturnDate(Date,'YY/MM/DD',0,0) from fin.ReceivedBankDraft where ReceivedBankDraftID = b.EntityID)
									 WHEN 2 THEN (select top 1 cfg.GetCLRSaturnDate(Date,'YY/MM/DD',0,0) 
													from fin.ReceiptCheqeFlowItem rcfi
													join fin.ReceivedCheqe rc on rc.ReceivedCheqeID = rcfi.ReceivedCheqeID
													 where ReceiptCheqeFlowItemID = b.EntityID)
									 WHEN 3 THEN (select top 1 cfg.GetCLRSaturnDate(Date,'YY/MM/DD',0,0) 
													from fin.ReceiptCheqeFlowItem rcfi
													join fin.ReceivedCheqe rc on rc.ReceivedCheqeID = rcfi.ReceivedCheqeID
													 where ReceiptCheqeFlowItemID = b.EntityID)
									 WHEN 4 THEN (select top 1 cfg.GetCLRSaturnDate(pc.Date,'YY/MM/DD',0,0) 
														from fin.PaymentSubject ps
														join fin.PaymentReceipt pr on pr.PaymentReceiptID = ps.PaymentReceiptID
														left join fin.PaymentCheqe pc on pc.PaymentReceiptID = pr.PaymentReceiptID
														where PaymentSubjectid = b.EntityID)
									 WHEN 5 THEN (select top 1 cfg.GetCLRSaturnDate(Date,'YY/MM/DD',0,0)  from fin.ReceivedBankDraft where ReceivedBankDraftid = b.EntityID)
									 WHEN 6 THEN (select top 1 cfg.GetCLRSaturnDate(Date,'YY/MM/DD',0,0)  from fin.PaymentCheqe where PaymentCheqeid = b.EntityID)
									 WHEN 7 THEN  (select top 1 cfg.GetCLRSaturnDate(Date,'YY/MM/DD',0,0)  from fin.PaymentCheqeFlowItem pcfi
															 join fin.PaymentCheqe pc on pc.PaymentCheqeID = pcfi.PaymentCheqeID where PaymentCheqeFlowItemid = b.EntityID )
									  WHEN 8 THEN cfg.GetCLRSaturnDate(bi.Date,'YY/MM/DD',0,0)
								END DateString,						
								2 Type,
								b.Description,
								bi.Description BookItemDescription
			 from  fin.ReconciledBookItem b
			 LEFT JOIN fin.BookItem bi ON b.EntityType = 8 AND b.entityID=bi.BookItemID
			 WHERE b.deposite > 0 and Passed = 0
  )
	 b on r.ReconciliationID = b.ReconciliationID 
where r.[ReconciliationID]  in (select id from #Ids)
