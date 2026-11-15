
---------------------------------- STRAT #
CREATE      view [FIN].[vwbankaccount_Detail]
--with encryption
as
	
	select BankAccountID,
	       FirstAmount Amount,
		   FirstDate Date,
		   CurrencyID,
		   -1 BranchID,
		   0 DocCode,
		   null HederID,
		   null HederNumber,
		   null Number,
		   null PartyID,
		   NULL FinancialPeriodID,
		   Null ReferenceNumber,
		   NULL VoucherDate,
		   Null as PrevoucherID
	from CFG.BankAccount 

	union all

	--واریز
	select b.BankAccountID,
	       b.Amount,
		   b.[Date],
		   b.CurrencyID,
		   r.BranchID,
		   1 DocCode,
		   b.ReceiveReceiptID HederID,
		   r.Number HederNumber,
		   b.Number,
		   r.PartyID,
		   r.FinancialPeriodID,
		   Null,
		   Null,
		   r.PreVoucherID
	from FIN.ReceivedBankDraft b
	join FIN.ReceiveReceipt r on b.ReceiveReceiptID = r.ReceiveReceiptID

	union all

	--نقد به بانک
	select f.BankAccountID,
	       c.Amount,
		   f.[Date],
		   c.CurrencyID,
		   f.BranchID,
		   2 DocCode,
		   f.ReceiptCheqeFlowID HederID,
		   f.InnerNumber HederNumber,
		   c.Number,
		   rr.PartyID,
		   f.FinancialPeriodID,
		   Null,--vw.ReferenceNumber,
		   Null,
		   f.PreVoucherID
	from FIN.ReceiptCheqeFlowItem i
	join FIN.ReceiptCheqeFlow f on i.ReceiptCheqeFlowID = f.ReceiptCheqeFlowID
	join FIN.ReceivedCheqe c on i.ReceivedCheqeID = c.ReceivedCheqeID
	join FIN.ReceiveReceipt rr on rr.ReceiveReceiptID = c.ReceiveReceiptID
	where f.[Type] = 2 and i.[State] = 4 

	union all

	--وصول
	select pf.BankAccountID,
	       c.Amount,
		   f.[Date],
		   c.CurrencyID,
		   f.BranchID,
		   3 DocCode,
		   f.ReceiptCheqeFlowID HederID,
		   f.InnerNumber HederNumber,
		   c.Number,
		   rr.PartyID,
		   f.FinancialPeriodID,
		  Null,-- vw.ReferenceNumber,
		  Null,
		  f.PreVoucherID
	from FIN.ReceiptCheqeFlowItem i
	join FIN.ReceiptCheqeFlow f on i.ReceiptCheqeFlowID = f.ReceiptCheqeFlowID
	join FIN.ReceivedCheqe c on i.ReceivedCheqeID = c.ReceivedCheqeID
	join FIN.ReceiveReceipt rr on rr.ReceiveReceiptID = c.ReceiveReceiptID
	left join (select r.ReceiptCheqeFlowItemID,r.ReceivedCheqeID,r2.BankAccountID 
	           from FIN.ReceiptCheqeFlowItem r
		       join FIN.ReceiptCheqeFlow r2 on r.ReceiptCheqeFlowID = r2.ReceiptCheqeFlowID 
		       where r.[State] = 1
			  ) pf on i.PreviousFlow = pf.ReceiptCheqeFlowItemID and i.ReceivedCheqeID = pf.ReceivedCheqeID
	where i.[State] = 6 

	union all

	--انتقال به بانک
	select b.BankAccountID,
	       s.Amount,
		   case when s.PaymentBankDraftID is not null then pbd.Date
										 when s.PaymentCheqeID is not null then pc.Date
										 else pr.[Date] end,
		   s.CurrencyID,
		   pr.BranchID,
		   4 DocCode,
		   s.PaymentReceiptID HederID,
		   pr.Number HederNumber,
		   null Number,
		   pr.PartyID,
		   pr.FinancialPeriodID,
		  Null,-- vw.ReferenceNumber,
		  Null,
		  pr.PreVoucherID
	from FIN.PaymentSubject s
	join FIN.PaymentReceipt pr on s.PaymentReceiptID = pr.PaymentReceiptID
	join FIN.PaymentType pt on pt.PaymentTypeID = s.PaymentTypeID
	join cfg.BankAccount b on b.DlID = s.DLID
	left join fin.PaymentBankDraft pbd on pbd.PaymentBankDraftID = s.PaymentBankDraftID
	left join fin.PaymentCheqe pc on pc.PaymentCheqeID = s.PaymentCheqeID
	where pt.Type = 4
	and pr.Status <> 2

	union all

	--وصول ضمانت نامه دریافتی
	select g.BankAccountID,
	       rgc.Amount - isnull(g2.DeductedAmount, 0) Amount, 
		   g.[date],
		   rgc.CurrencyID,
		   g.BranchID,
		   8 DocCode,
		   g.GuarantyOperationID HederID,
		   g.Number HederNumber,
		   rgc.Number,
		   null PartyID,
		   g.FinancialPeriodID,
		  Null,-- vw.ReferenceNumber,
		  Null,
		  g.PreVoucherID
	from FIN.GuarantyOperation g
	left join FIN.ReceiveGuarantyCommitment rgc on g.ReceiveGuarantyCommitmentID = rgc.ReceiveGuarantyCommitmentID
	left join (select ReceiveGuarantyCommitmentID,sum(DeductedAmount) DeductedAmount
			   from FIN.GuarantyOperation 
			   where CommitmentType = 1 and OperationType = 2 
			   group by ReceiveGuarantyCommitmentID
			  ) g2 on g.ReceiveGuarantyCommitmentID = g2.ReceiveGuarantyCommitmentID
	where g.CommitmentType = 1 and g.OperationType = 4 

	union all

	--استرداد چک روز
	select c.BankAccountID,
	       c.Amount,
		   f.[Date],
		   c.CurrencyID,
		   f.BranchID,
		   9 DocCode,
		   f.PaymentCheqeFlowID HederID,
		   f.InnerNumber HederNumber,
		   c.Number,
		   f.PartyID,
		   f.FinancialPeriodID,
		   Null,--vw.ReferenceNumber,
		   Null,
		   f.PreVoucherID
	from FIN.PaymentCheqeFlowItem i
	join FIN.PaymentCheqeFlow f on i.PaymentCheqeFlowID = f.PaymentCheqeFlowID
	join FIN.PaymentCheqe c on i.PaymentCheqeID = c.PaymentCheqeID
	join FIN.PaymentCheqeType t on c.PaymentCheqeTypeID = t.PaymentCheqeTypeID
	where f.[Type] = 1 and t.Today = 1 

	union all

	--برداشت
	select b.BankAccountID,
	      -(Amount+wage) Amount,
		  b.[Date],
		  b.CurrencyID,
		  r.BranchID,
		  5 DocCode,
		  r.PaymentReceiptID HederID,
		  r.Number HederNumber,
		  b.Number,
		  r.PartyID,
		  r.FinancialPeriodID,
		   Null,--vw.ReferenceNumber,
		   Null,
		   r.PreVoucherID
	from FIN.PaymentBankDraft b 
	join FIN.PaymentReceipt r on r.PaymentReceiptID = b.PaymentReceiptID
	where r.Status <> 2

	union all

	--چک روز
	select c.BankAccountID,
	      -c.Amount Amount, 
		  c.[Date],
		  c.CurrencyID,
		  r.BranchID,
		  6 DocCode,
		  r.PaymentReceiptID HederID,
		  r.Number HederNumber,
		  c.Number,
		  r.PartyID,
		  r.FinancialPeriodID,
		  Null,-- vw.ReferenceNumber,
		  Null,r.PreVoucherID
	from FIN.PaymentCheqe c
	join FIN.PaymentReceipt r on r.PaymentReceiptID = c.PaymentReceiptID
	join FIN.PaymentCheqeType t on c.PaymentCheqeTypeID = t.PaymentCheqeTypeID
	where t.Today = 1 and c.LastState = 0 and r.Status <> 2

	union all

	--نقد شدن چک مدت دار
	select c.BankAccountID,
	      -c.Amount Amount,
		  f.[Date],
		  c.CurrencyID,
		  f.BranchID,
		  7 DocCode,
		  f.PaymentCheqeFlowID HederID,
		  f.InnerNumber HederNumber,
		  c.Number,
		  null PartyID,
		  f.FinancialPeriodID,
		   Null,--vw.ReferenceNumber,
		   Null,
		   f.PreVoucherID
	from FIN.PaymentCheqeFlowItem i
	join FIN.PaymentCheqeFlow f on i.PaymentCheqeFlowID = f.PaymentCheqeFlowID
	join FIN.PaymentCheqe c on i.PaymentCheqeID = c.PaymentCheqeID
	where f.[Type] = 0 

	union all

	--وصول ضمانت نامه پرداختی
	select g.BankAccountID,
	      -(pgc.Amount - isnull(g2.DeductedAmount,0)) Amount,
		  g.[date],
		  pgc.CurrencyID,
		  g.BranchID,
		  8 DocCode,
		  g.GuarantyOperationID HederID,
		  g.Number HederNumber,
		  pgc.Number,
		  null PartyID,
		  g.FinancialPeriodID,
		   Null,--vw.ReferenceNumber,
		   Null,
		   g.PreVoucherID
	from FIN.GuarantyOperation g
	left join FIN.PaymentGuarantyCommitment pgc on g.PaymentGuarantyCommitmentID = pgc.PaymentGuarantyCommitmentID
	left join (select PaymentGuarantyCommitmentID,sum(DeductedAmount) DeductedAmount
			   from FIN.GuarantyOperation 
			   where CommitmentType = 2 and OperationType = 2 
			   group by PaymentGuarantyCommitmentID
			  ) g2 on g.PaymentGuarantyCommitmentID = g2.PaymentGuarantyCommitmentID
	where g.CommitmentType = 2 and g.OperationType = 4 

	union all

	select i.BankAccountID,
		   i.Amount,
		   h.Date,
		   i.CurrencyID,
		   s.BranchID,
		   10 DocCode,
		   h.PosInvoiceID HederID,
		   h.Number HederNumber,
		   i.TracingNumber Number,
		   h.CustomerID PartyID,
		   h.FinancialPeriodID,
		   null,
		   null,
		   Null
	from pos.PosReceiptItem i
	join pos.PosReceipt h on i.PosReceiptID = h.PosReceiptID
	join pos.StationShift ss on h.StationShiftID = ss.StationShiftID
	join pos.Station s on s.StationID = ss.StationID
	where ItemType = 6
