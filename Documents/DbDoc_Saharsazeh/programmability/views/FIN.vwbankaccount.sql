

CREATE   view [FIN].vwbankaccount
--with encryption
as
	
	select BankAccountID,FirstAmount Amount,FirstDate Date,CurrencyID,-1 BranchID ,NULL AS FinancialPeriodID
	from CFG.BankAccount 

	union all

	--واریز
	select BankAccountID,Amount,b.[Date],CurrencyID,BranchID,r.FinancialPeriodID
	from FIN.ReceivedBankDraft b
	join FIN.ReceiveReceipt r on b.ReceiveReceiptID = r.ReceiveReceiptID

	union all

	--نقد به بانک
	select f.BankAccountID,Amount,f.[Date],CurrencyID,BranchID,f.FinancialPeriodID
	from FIN.ReceiptCheqeFlowItem i
	join FIN.ReceiptCheqeFlow f on i.ReceiptCheqeFlowID = f.ReceiptCheqeFlowID
	join FIN.ReceivedCheqe c on i.ReceivedCheqeID = c.ReceivedCheqeID
	where f.[Type] = 2 and i.[State] = 4 

	union all

	--وصول
	select pf.BankAccountID,Amount,f.[Date],CurrencyID,BranchID,f.FinancialPeriodID
	from FIN.ReceiptCheqeFlowItem i
	join FIN.ReceiptCheqeFlow f on i.ReceiptCheqeFlowID = f.ReceiptCheqeFlowID
	join FIN.ReceivedCheqe c on i.ReceivedCheqeID = c.ReceivedCheqeID
	left join (select r.ReceiptCheqeFlowItemID,r.ReceivedCheqeID,r2.BankAccountID 
	           from FIN.ReceiptCheqeFlowItem r
		       join FIN.ReceiptCheqeFlow r2 on r.ReceiptCheqeFlowID = r2.ReceiptCheqeFlowID 
		       where r.[State] = 1
			  ) pf on i.PreviousFlow = pf.ReceiptCheqeFlowItemID and i.ReceivedCheqeID = pf.ReceivedCheqeID
	where i.[State] = 6 

	union all

	--انتقال به بانک
	select b.BankAccountID,s.Amount,case when s.PaymentBankDraftID is not null then pbd.Date
										 when s.PaymentCheqeID is not null then pc.Date
										 else pr.[Date] end,s.CurrencyID,BranchID,pr.FinancialPeriodID
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
	select g.BankAccountID, rgc.Amount - isnull(g2.DeductedAmount, 0) Amount, g.[date],CurrencyID,BranchID,g.FinancialPeriodID
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
	select c.BankAccountID,Amount,f.[Date],CurrencyID,BranchID,f.FinancialPeriodID
	from FIN.PaymentCheqeFlowItem i
	join FIN.PaymentCheqeFlow f on i.PaymentCheqeFlowID = f.PaymentCheqeFlowID
	join FIN.PaymentCheqe c on i.PaymentCheqeID = c.PaymentCheqeID
	join FIN.PaymentCheqeType t on c.PaymentCheqeTypeID = t.PaymentCheqeTypeID
	where f.[Type] = 1 and t.Today = 1 

	union all

	--برداشت
	select BankAccountID,-(Amount+Wage) Amount,b.[Date],CurrencyID,BranchID,r.FinancialPeriodID
	from FIN.PaymentBankDraft b 
	join FIN.PaymentReceipt r on r.PaymentReceiptID = b.PaymentReceiptID
	where r.Status <> 2

	union all

	--چک روز
	select c.BankAccountID, -c.Amount Amount, c.[Date],CurrencyID,BranchID,r.FinancialPeriodID
	from FIN.PaymentCheqe c
	join FIN.PaymentReceipt r on r.PaymentReceiptID = c.PaymentReceiptID
	join FIN.PaymentCheqeType t on c.PaymentCheqeTypeID = t.PaymentCheqeTypeID
	where t.Today = 1 and c.LastState = 0 and r.Status <> 2

	union all

	--نقد شدن چک مدت دار
	select c.BankAccountID,-c.Amount Amount,f.[Date],CurrencyID,BranchID,f.FinancialPeriodID
	from FIN.PaymentCheqeFlowItem i
	join FIN.PaymentCheqeFlow f on i.PaymentCheqeFlowID = f.PaymentCheqeFlowID
	join FIN.PaymentCheqe c on i.PaymentCheqeID = c.PaymentCheqeID
	where f.[Type] = 0 

	union all

	--وصول ضمانت نامه پرداختی
	select g.BankAccountID,-(pgc.Amount - isnull(g2.DeductedAmount,0)) Amount,g.[date],CurrencyID,BranchID,g.FinancialPeriodID
	from FIN.GuarantyOperation g
	left join FIN.PaymentGuarantyCommitment pgc on g.PaymentGuarantyCommitmentID = pgc.PaymentGuarantyCommitmentID
	left join (select PaymentGuarantyCommitmentID,sum(DeductedAmount) DeductedAmount
			   from FIN.GuarantyOperation 
			   where CommitmentType = 2 and OperationType = 2 
			   group by PaymentGuarantyCommitmentID
			  ) g2 on g.PaymentGuarantyCommitmentID = g2.PaymentGuarantyCommitmentID
	where g.CommitmentType = 2 and g.OperationType = 4 

	union all

	select i.BankAccountID,i.Amount,h.Date,i.CurrencyID,s.BranchID,h.FinancialPeriodID
	from pos.PosReceiptItem i
	join pos.PosReceipt h on i.PosReceiptID = h.PosReceiptID
	join pos.StationShift ss on h.StationShiftID = ss.StationShiftID
	join pos.Station s on s.StationID = ss.StationID
	where ItemType = 6
