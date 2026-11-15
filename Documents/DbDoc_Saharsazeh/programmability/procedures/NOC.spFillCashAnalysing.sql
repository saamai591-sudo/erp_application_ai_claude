
------------------------------------
Create    proc NOC.spFillCashAnalysing 
(
@ReportagePeriodID int,
@Confirm bit
)
--WITH ENCRYPTION
as
BEGIN TRY

	if exists(select * from NOC.Analysing where ReportagePeriodID = @ReportagePeriodID and Type = 1)
	begin
		raiserror('PeriodAndTypeDup',16,12)
		return 
	end	

		declare @EndDate date,
				@user int,
				@PreviousPeriod int,
				@AnalysingID int,
				@CurrencyReport int

		set @user = cfg.GetuserID()

		select  @EndDate = enddate
		from NOC.ReportagePeriod
		where ReportagePeriodid = @ReportagePeriodID

		select top 1 @PreviousPeriod = ReportagePeriodID
		from NOC.ReportagePeriod
		where EndDate < @EndDate
		order by EndDate desc

		select @CurrencyReport = ConfigValue
		from noc.NIOCSetting
		where ConfigKey = 'CurrencyReport'

		create table #CashAnalysing
		(
		[CashAnalysingID] int,
		[CashDataCollectionID] int,
		[Status] Tinyint
		)

		declare @Maxid int

		set @Maxid = isnull((select max(CashAnalysingID) from noc.CashAnalysing),0)

		INSERT INTO #CashAnalysing
				   (CashAnalysingID
				   ,[CashDataCollectionID]
				   ,[Status])
		select		@Maxid + ROW_NUMBER() over(order by [CashDataCollectionID])
				   ,[CashDataCollectionID]
				   ,0
		from noc.CashDataCollection a
		join noc.DataCollection b
			on a.DataCollectionID = b.DataCollectionID
		where b.ReportagePeriodID = @ReportagePeriodID

		create table #DI
		(
		DestructionItemID int,
		EffectiveDate Date,
		DocumentNumber int,
		ReferenceNumber int,
		VoucherID int,
		VoucherDate Date,
		Amount decimal(36,10),
		PreVoucherID int,
		AssetCategoryID int,
		DlID int 
		)
		insert into #DI
		exec NOC.SpGetDestructionItem

		create table #CategoryAccountTemp
		(
			  [AssetCategoryID] int
			  ,[FixAsset] int
			  ,[CompletingAsset] int
			  ,[IncomeFromSale] int
			  ,[IncomeFromRevaluation] int
			  ,[IncomeFromInsurance] int
			  ,[DepreciationCost] int
			  ,[AccumulatedDepreciation] int
			  ,[LossOfStopWorking] int
			  ,[RepairCost] int
			  ,[GiftCost] int
			  ,[TransfersBetweenBranches] int
		)

		insert into #CategoryAccountTemp
		exec [AST].[SpFindCategoryAccount]

		select * into #VwPaymentReceipt from NOC.VwPaymentReceipt 
		select * into #VwDebitCreditNote from NOC.VwDebitCreditNote 
		select * into #VwPettyCashCost from NOC.VwPettyCashCost 
		select * into #VWPurchaseInvoicePrePayment from NOC.VWPurchaseInvoicePrePayment 
		select * into #VwConfirmStatementItem from NOC.VwConfirmStatementItem 
		select * into #FnAdvanceDepreciation from [NOC].[FnAdvanceDepreciation] ()
		select * into #VwReceiveReceipt from NOC.VwReceiveReceipt 
		select * into #VwDepreciatedDeductionInConfirmStatement from NOC.VwDepreciatedDeductionInConfirmStatement 
		select * into #VWConfirmPurchaseInvoiceAdvancePayment from  NOC.VWConfirmPurchaseInvoiceAdvancePayment

		select b.CashAnalysingID,
				case when C.PaymentSubjectID IS NOT NULL THEN d.EffectiveDate
					  when C.DebitCreditNoteItemID IS NOT NULL THEN e.EffectiveDate
					  when C.PettyCashCostItemID IS NOT NULL THEN f.EffectiveDate
					  when C.ConfirmStatementPrePaymentID IS NOT NULL THEN csi.EffectiveDate
					  when C.PurchaseInvoicePrePaymentID IS NOT NULL THEN vip.EffectiveDate
					  when C.CalculationResultID IS NOT NULL THEN ad.EndDate 
					  when C.ReceiveSubjectID IS NOT NULL THEN rr.EffectiveDate
					  when c.ConfirmStatementItemID IS NOT NULL THEN ddcs.EffectiveDate
					  when c.DestructionItemID IS NOT NULL THEN di.EffectiveDate
					  when c.ConfirmPurchaseInvoiceAdvancePaymentID IS NOT NULL THEN p.EffectiveDate
					  end Date,
				 case when C.PaymentSubjectID IS NOT NULL THEN d.PaymentTypeID
					  when C.DebitCreditNoteItemID IS NOT NULL THEN e.PaymentTypeID
					  when C.PettyCashCostItemID IS NOT NULL THEN f.PaymentTypeID
					  when C.PurchaseInvoicePrePaymentID IS NOT NULL THEN vip.PaymentTypeID
					  when C.ConfirmPurchaseInvoiceAdvancePaymentID IS NOT NULL THEN p.PaymentTypeID
					  end PaymentTypeID,
				 case when C.ReceiveSubjectID IS NOT NULL THEN rr.ReceiptTypeID
					  when C.DebitCreditNoteItemID IS NOT NULL  THEN e.ReceiptTypeID
					  end ReceiptTypeID,
				 case when C.PaymentSubjectID IS NOT NULL THEN d.PurchaseInvoiceID
					  when C.DebitCreditNoteItemID IS NOT NULL THEN e.PurchaseInvoiceID
					  when C.PettyCashCostItemID IS NOT NULL THEN f.PurchaseInvoiceID
					  when C.ReceiveSubjectID IS NOT NULL THEN rr.PurchaseInvoiceID
					  end PurchaseInvoiceID,
				 case when C.PaymentSubjectID IS NOT NULL THEN d.ConfirmPurchaseInvoiceID
					  when C.DebitCreditNoteItemID IS NOT NULL THEN e.ConfirmPurchaseInvoiceID
					  when C.PettyCashCostItemID IS NOT NULL THEN f.ConfirmPurchaseInvoiceID
					  end ConfirmPurchaseInvoiceID,
				 case when C.PaymentSubjectID IS NOT NULL THEN d.ConfirmPurchaseInvoiceItemID
					  when C.DebitCreditNoteItemID IS NOT NULL THEN e.ConfirmPurchaseInvoiceItemID
					  when C.PettyCashCostItemID IS NOT NULL THEN f.ConfirmPurchaseInvoiceItemID
					  end ConfirmPurchaseInvoiceItemID,
				 case  when C.DebitCreditNoteItemID IS NOT NULL THEN e.ReturnInvoiceID
					  when C.ReceiveSubjectID IS NOT NULL THEN rr.ReturnInvoiceID
					  end ReturnInvoiceID,
				 case when C.PaymentSubjectID IS NOT NULL THEN d.ContractID
					  when C.DebitCreditNoteItemID IS NOT NULL THEN e.ContractID
					  when C.ReceiveSubjectID IS NOT NULL THEN rr.ContractID
					  end ContractID,
				 case when C.PaymentSubjectID IS NOT NULL THEN d.ConfirmStatementID
					  when C.DebitCreditNoteItemID IS NOT NULL THEN e.ConfirmStatementID
					  when C.ReceiveSubjectID IS NOT NULL THEN rr.ConfirmStatementID
					  end ConfirmStatementID,
				 case when C.PaymentSubjectID IS NOT NULL THEN d.ConfirmStatementItemID
					  when C.DebitCreditNoteItemID IS NOT NULL THEN e.ConfirmStatementItemID
					  when C.ReceiveSubjectID IS NOT NULL THEN rr.ConfirmStatementItemID
					  else C.ConfirmStatementItemID 
					  end AdditionDeduction,
				 case when C.PaymentSubjectID IS NOT NULL THEN d.ContractStatementID
					  when C.DebitCreditNoteItemID IS NOT NULL THEN e.ContractStatementID
					  when C.ReceiveSubjectID IS NOT NULL THEN rr.ContractStatementID
					  end ContractStatementID,
				 case when C.PaymentSubjectID IS NOT NULL THEN d.CalculationResultID
					  when C.DebitCreditNoteItemID IS NOT NULL THEN e.CalculationResultID
					  end PayOfCalculationResult,
				 case when C.PaymentSubjectID IS NOT NULL THEN d.PayPreparingID
					  when C.PettyCashCostItemID IS NOT NULL THEN f.PayPreparingID
					  end PayPreparingID,				
				 vip.PurchaseInvoicePrePaymentID,
				 csi.ConfirmStatementPrePaymentID,
				 p.ConfirmPurchaseInvoiceAdvancePaymentID,
				 case when C.ConfirmStatementPrePaymentID IS NOT NULL THEN csi.ConfirmStatementID
					  when C.PurchaseInvoicePrePaymentID IS NOT NULL THEN vip.PurchaseInvoiceID
					  when c.ConfirmPurchaseInvoiceAdvancePaymentID is not null then p.PurchaseInvoiceID
					  end BaseOfDepreciation,				 
				 case when C.PaymentSubjectID IS NOT NULL THEN d.Amount
					  when C.DebitCreditNoteItemID IS NOT NULL THEN e.Amount
					  when C.PettyCashCostItemID IS NOT NULL THEN f.Amount
					  when C.ConfirmStatementPrePaymentID IS NOT NULL THEN csi.Amount
					  when C.PurchaseInvoicePrePaymentID IS NOT NULL THEN vip.Amount
					  when c.ConfirmPurchaseInvoiceAdvancePaymentID is not null then p.Amount
					  when C.CalculationResultID IS NOT NULL THEN ad.value
					  when C.ReceiveSubjectID IS NOT NULL THEN rr.Amount
					  when c.ConfirmStatementItemID IS NOT NULL THEN ddcs.Amount
					  when c.DestructionItemID IS NOT NULL THEN -1 * di.Amount
					  end BaseAmount,
				 case when C.PaymentSubjectID IS NOT NULL and d.CurrencyID = @CurrencyReport THEN d.CurrencyAmount
					  when C.DebitCreditNoteItemID IS NOT NULL and e.CurrencyID = @CurrencyReport  THEN e.CurrencyAmount
					  when C.PettyCashCostItemID IS NOT NULL and f.CurrencyID = @CurrencyReport  THEN f.CurrencyAmount
					  when C.ConfirmStatementPrePaymentID IS NOT NULL and csi.CurrencyID = @CurrencyReport  THEN csi.CurrencyAmount
					  when C.PurchaseInvoicePrePaymentID IS NOT NULL and vip.CurrencyID = @CurrencyReport  THEN vip.CurrencyAmount
					  when c.ConfirmPurchaseInvoiceAdvancePaymentID is not null and p.CurrencyID = @CurrencyReport then p.CurrencyAmount
					  --when C.CalculationResultID IS NOT NULL THEN ad.value
					  when C.ReceiveSubjectID IS NOT NULL and rr.CurrencyID = @CurrencyReport  THEN rr.CurrencyAmount
					  when c.ConfirmStatementItemID IS NOT NULL and ddcs.CurrencyID = @CurrencyReport  THEN ddcs.CurrencyAmount
					  --when c.DestructionItemID IS NOT NULL THEN -1 * di.Amount
					  end Amount,
				 case when C.PaymentSubjectID IS NOT NULL  THEN d.CurrencyID
					  when C.DebitCreditNoteItemID IS NOT NULL  THEN e.CurrencyID
					  when C.PettyCashCostItemID IS NOT NULL  THEN f.CurrencyID
					  when C.ConfirmStatementPrePaymentID IS NOT NULL   THEN csi.CurrencyID
					  when C.PurchaseInvoicePrePaymentID IS NOT NULL  THEN vip.CurrencyID
					  when c.ConfirmPurchaseInvoiceAdvancePaymentID is not null then p.CurrencyID
					  when C.CalculationResultID IS NOT NULL THEN -1
					  when C.ReceiveSubjectID IS NOT NULL   THEN rr.CurrencyID
					  when c.ConfirmStatementItemID IS NOT NULL  THEN ddcs.CurrencyID
					  when c.DestructionItemID IS NOT NULL THEN -1 
					  end CurrencyID,
					null  ReportCurrencyRate,
				 case when C.PaymentSubjectID IS NOT NULL THEN d.BaseVoucherID
					  when C.DebitCreditNoteItemID IS NOT NULL THEN e.VoucherID
					  when C.PettyCashCostItemID IS NOT NULL THEN f.VoucherID
					  when C.ConfirmStatementPrePaymentID IS NOT NULL THEN csi.VoucherID
					  when C.PurchaseInvoicePrePaymentID IS NOT NULL THEN vip.VoucherID
					  when c.ConfirmPurchaseInvoiceAdvancePaymentID is not null then p.VoucherID
					  when C.CalculationResultID IS NOT NULL THEN  ad.VoucherID
					  when c.ConfirmStatementItemID IS NOT NULL THEN ddcs.VoucherID
					  when c.ReceiveSubjectID is not null then rr.BaseVoucherID
					  when c.DestructionItemID IS NOT NULL THEN di.VoucherID
					  end VoucherID,
				case when c.PaymentSubjectID is not null then d.DlID
					 when c.DebitCreditNoteItemID is not null then e.DlID
					 when c.PettyCashCostItemID is not null then f.DlID
					 when c.PurchaseInvoicePrePaymentID is not null then vip.DlID
					 when c.ConfirmPurchaseInvoiceAdvancePaymentID is not null then p.DlID
					 when c.ConfirmStatementPrePaymentID is not null then csi.DlID
					 when C.CalculationResultID IS NOT NULL THEN  ad.DlID
					 when c.ReceiveSubjectID is not null then rr.DlID
					 when c.ConfirmStatementItemID IS NOT NULL THEN ddcs.DlID
					 when c.DestructionItemID IS NOT NULL THEN di.DlID
					 end DlID,
				case when c.PaymentSubjectID is not null then 'PaymentSubject'
					 when c.DebitCreditNoteItemID is not null then 'DebitCreditNoteItem'
					 when c.PettyCashCostItemID is not null then 'PettyCashCostItem'
					 end TypeInDateCollected,
				case when c.PaymentSubjectID is not null then d.PreVoucherID
					 when c.DebitCreditNoteItemID is not null then e.PreVoucherID
					 when c.PettyCashCostItemID is not null then f.PreVoucherID
					 when c.ConfirmStatementPrePaymentID is not null then csi.PreVoucherID
					 when c.ReceiveSubjectID is not null then rr.PreVoucherID
					 when c.DestructionItemID IS NOT NULL THEN di.PreVoucherID
					 end PreVoucherID,
				case when C.CalculationResultID IS NOT NULL THEN  ad.CalculationPersonelID end CalculationPersonelID,
				c.DestructionItemID
				into #T
		  from  #CashAnalysing b
		  join noc.CashDataCollection c
			on b.CashDataCollectionID = c.CashDataCollectionID
		  left join #VwPaymentReceipt d
			on d.PaymentSubjectID = c.PaymentSubjectID
		  left join #VwDebitCreditNote e
			on e.DebitCreditNoteItemID = c.DebitCreditNoteItemID
		  left join #VwPettyCashCost f
			on f.PettyCashCostItemID = c.PettyCashCostItemID
		  left join #VWPurchaseInvoicePrePayment vip
			on vip.PurchaseInvoicePrePaymentID = c.PurchaseInvoicePrePaymentID		
		  left join	#VwConfirmStatementItem csi
			on csi.ConfirmStatementPrePaymentID = c.ConfirmStatementPrePaymentID
		  left join #FnAdvanceDepreciation ad
			on ad.CalculationResultID = 	c.CalculationResultID	
		  left join #VwReceiveReceipt rr
			on rr.ReceiveSubjectID = c.ReceiveSubjectID
		 left join #VwDepreciatedDeductionInConfirmStatement ddcs
			on ddcs.ConfirmStatementItemID = c.ConfirmStatementItemID
		 left join #DI di
			on di.DestructionItemID = c.DestructionItemID
		 left join #VWConfirmPurchaseInvoiceAdvancePayment p
			on p.ConfirmPurchaseInvoiceAdvancePaymentID = c.ConfirmPurchaseInvoiceAdvancePaymentID

		update #T
		set ReportCurrencyRate = 	isnull([CFG].[GetReportCurrencyRate] (Date),1)
		where isnull(CurrencyID , -1) <> @CurrencyReport

		update #T
		set Amount = 	 ROUND((BaseAmount/ReportCurrencyRate),2)
		where isnull(CurrencyID , -1) <> @CurrencyReport

		begin

		exec NOC.SpCalculationTypeHasReserve

			create table  #R
			(
			CashAnalysingID int,
			SlID int,
			Amount decimal(30,4),
			BaseAmount decimal(30,4),
			AccrueVoucherID int,
			AccruePreVoucherID int,
			ShareOfRoundingIsAllowed Bit ,
			ID int IDENTITY (1, 1) 
			)

			/*خروج دارایی*/
			insert into #R
			select   a.CashAnalysingID
					,b.FixAsset
					,a.Amount		
					,a.BaseAmount
					,di.VoucherID 
					,di.PreVoucherID
					,1
				from #T a
				join #DI di
					on a.DestructionItemID = di.DestructionItemID
				join #CategoryAccountTemp b 
					on b.AssetCategoryID = di.AssetCategoryID


			/*پرداختهای بدون مبنا*/
			insert into #R
			select  CashAnalysingID
					,e.SlID
					,Amount		
					,BaseAmount
					,VoucherID 
					,PreVoucherID
					,1
				from #T 
				join fin.PaymentType d
					on #T.PaymentTypeID = d.PaymentTypeID
				join noc.reportheadline e
					on e.SlID = d.SLID
					where PurchaseInvoicePrePaymentID is null
					and PayOfCalculationResult is null
					and ConfirmPurchaseInvoiceAdvancePaymentID is null
					and e.OnlyInPeriodReview = 0
		

			/*دریافتهای بدون مبنا*/
			insert into #R
			select  CashAnalysingID
					,e.SlID
					,Amount		
					,BaseAmount
					,VoucherID 
					,PreVoucherID
					,1
				from #T 
				join fin.ReceiptType d
					on #T.ReceiptTypeID = d.ReceiptTypeID
				join noc.reportheadline e
					on e.SlID = d.SLID
				where  e.OnlyInPeriodReview = 0
				
			declare @VatPayment int
			select @VatPayment = b.EntityCustomeFieldID
			from cfg.EntityCustomeField b
			where b.EntityName = 'PaymentType'
			and b.FieldName = 'VatPayment'	

			/*پرداخت بر مبنای فاکتور خرید*/
			/*خالص و ارزش افزوده فاکتور فاقد تایید مالی*/
			if @VatPayment is null
			insert into #R
			select  CashAnalysingID
					,d.SlID
					,round(Amount * d.Share , 2)	Amount
					,round(BaseAmount * d.Share ,0)  BaseAmount
					,d.VoucherID
					,d.AccruePreVoucherID
					,1
				from #T
				join NOC.VWTraceOfPurchaseInvoice d
					on d.PurchaseInvoiceID = #T.PurchaseInvoiceID
				where d.HasConfirmStatement = 0


			if @VatPayment is not null --خالص
			insert into #R
			select  CashAnalysingID
					,d.SlID
					,round(Amount * d.Share , 2)	Amount
					,round(BaseAmount * d.Share ,0)  BaseAmount
					,d.VoucherID
					,d.AccruePreVoucherID
					,1
				from #T
				join NOC.VWTraceOfPurchaseInvoice_Net d
					on d.PurchaseInvoiceID = #T.PurchaseInvoiceID
				left join
				(
					select a.EntityID,a.Value
					from cfg.EntityCustomeFieldData a
					where EntityCustomeFieldID = @VatPayment		
				) e on #T.PaymentTypeID = e.EntityID
				where e.EntityID is null and HasConfirmStatement = 0


			if @VatPayment is not null --ارزش افزوده
			insert into #R
			select  CashAnalysingID
					,d.SlID
					,round(Amount * d.Share , 2)	Amount
					,round(BaseAmount * d.Share ,0)  BaseAmount
					,d.VoucherID
					,d.AccruePreVoucherID
					,1
				from #T
				join NOC.VWTraceOfPurchaseInvoice_Vat d
					on d.PurchaseInvoiceID = #T.PurchaseInvoiceID
				join
				(
					select a.EntityID,a.Value
					from cfg.EntityCustomeFieldData a
					where EntityCustomeFieldID = @VatPayment		
				) e on #T.PaymentTypeID = e.EntityID
				where HasConfirmStatement = 0
				
			/*پرداخت بر مبنای فاکتور خرید*/
			/*ارزش افزوده فاکتور دارای تایید مالی*/
			insert into #R
			select  CashAnalysingID
					,d.SlID
					,round(Amount * d.Share , 2)	Amount
					,round(BaseAmount * d.Share ,0)  BaseAmount
					,d.VoucherID
					,d.AccruePreVoucherID
					,1
				from #T
				join NOC.VWTraceOfPurchaseInvoice_Vat d
					on d.PurchaseInvoiceID = #T.PurchaseInvoiceID
					where HasConfirmStatement = 1
			/*پرداخت بر مبنای فاکتور خرید*/
			/*خالص فاکتورهای دارای تایید مالی*/
			insert into #R
			select  CashAnalysingID
					,d.SlID
					,round(Amount * d.Share , 2)	Amount
					,round(BaseAmount * d.Share ,0)  BaseAmount
					,d.VoucherID
					,d.AccruePreVoucherID
					,1
				from #T
				join NOC.VWTraceOfPurchaseInvoice_Net d
					on d.ConfirmPurchaseInvoiceID = #T.ConfirmPurchaseInvoiceID

			/*پرداخت کسور فاکتور خرید دارای تایید مالی*/
			insert into #R
			select  CashAnalysingID
					,d.SlID			
					,round(#T.Amount * d.Share,2) Amount 
					,round(BaseAmount * d.Share,0) BaseAmount
					,d.VoucherID
					,d.AccruePreVoucherID
					,1
				from #T
				join NOC.VWAddDeducPerConfirmPurchaseInvoiceItem d
					on d.ConfirmPurchaseInvoiceItemID = #T.ConfirmPurchaseInvoiceItemID		

			/*دریافت و پرداخت بر مبنای برگشت خرید*/
			insert into #R
			select  CashAnalysingID
					,d.SlID
					,round(Amount * d.Share , 2)	Amount
					,round(BaseAmount * d.Share ,0)  BaseAmount
					,d.VoucherID
					,d.AccruePreVoucherID
					,1
				from #T
				join NOC.VWTraceOfReturnInvoice d
					on d.ReturnInvoiceID = #T.ReturnInvoiceID

			/*پرداخت ارزش افزوده صورت وضعیت*/
			insert into #R
			select  CashAnalysingID
					,b.SlID
					,round(Amount * b.Share,2)	Amount
					,round(BaseAmount * b.Share,0)   BaseAmount
					,b.VoucherID
					,b.PreVoucherID
					,1
				from #T a
				join noc.VWContractVat b
					on a.ContractStatementID = b.ContractStatementID
					

			/*پرداخت خالص صورت وضعیت*/
			insert into #R
			select  CashAnalysingID
				,d.SlID	
				,round(#T.Amount * d.Share,2)	Amount
				,round(BaseAmount * d.Share,0)   BaseAmount
				,d.VoucherID
				,d.PreVoucherID
				,1
			from #T
			join NOC.VWConfirmStatementPortion d
				on d.ConfirmStatementID = #T.ConfirmStatementID	




			/*پرداخت کسور صورت وضعیت*/
			insert into #R
			select  CashAnalysingID
					,d.SlID			
					,round(#T.Amount * d.Share,2) Amount 
					,round(BaseAmount * d.Share,0) BaseAmount
					,d.VoucherID
					,d.PreVoucherID
					,1
				from #T
				join NOC.VWAdditionDeductionPortion d
					on d.ConfirmStatementItemID = #T.AdditionDeduction		


			/*استهلاک پیش پرداخت در فاکتور خرید*/
			insert into #R
			select  CashAnalysingID
					,d.SlID		
					,round(#T.Amount * d.Share,2)	Amount
					,round(BaseAmount * d.Share,0)   BaseAmount
					,d.VoucherID
					,d.AccruePreVoucherID
					,1
				from #T
				join NOC.VWPurchaseInvoicePrePaymentSlPortion d
					on d.PurchaseInvoicePrePaymentID = #T.PurchaseInvoicePrePaymentID	



			/*کسر از پیش پرداخت مبنی بر استهلاک در فاکتور خرید*/
			insert into #R
			select  CashAnalysingID
					,pt.SlID		
					,-1 * #T.Amount 	Amount
					,-1 * BaseAmount     BaseAmount
					,VoucherID
					,null
					,1
				from #T
				join 
				(
				select PurchaseInvoicePrePaymentID 
				from NOC.VWPurchaseInvoicePrePaymentSlPortion
				group by PurchaseInvoicePrePaymentID
				) d		
					on d.PurchaseInvoicePrePaymentID = #T.PurchaseInvoicePrePaymentID	
				join fin.PaymentType pt
					on pt.PaymentTypeID = #T.PaymentTypeID



			/*استهلاک پیش پرداخت در تایید مالی فاکتور خرید*/
			insert into #R
			select  CashAnalysingID
					,d.SlID		
					,round(#T.Amount * d.Share,2)	Amount
					,round(BaseAmount * d.Share,0)   BaseAmount
					,d.VoucherID
					,d.AccruePreVoucherID
					,1
				from #T
				join NOC.VWConfirmPurchaseInvoiceAdvancePaymentSlPortion d
					on d.ConfirmPurchaseInvoiceAdvancePaymentID = #T.ConfirmPurchaseInvoiceAdvancePaymentID	



			/*کسر از پیش پرداخت مبنی بر استهلاک در تایید مالی فاکتور خرید*/
			insert into #R
			select  CashAnalysingID
					,pt.SlID		
					,-1 * #T.Amount 	Amount
					,-1 * BaseAmount     BaseAmount
					,VoucherID
					,null
					,1
				from #T
				join 
				(
				select ConfirmPurchaseInvoiceAdvancePaymentID 
				from NOC.VWConfirmPurchaseInvoiceAdvancePaymentSlPortion
				group by ConfirmPurchaseInvoiceAdvancePaymentID
				) d		
					on d.ConfirmPurchaseInvoiceAdvancePaymentID = #T.ConfirmPurchaseInvoiceAdvancePaymentID	
				join fin.PaymentType pt
					on pt.PaymentTypeID = #T.PaymentTypeID

					


			/*استهلاک پیش پرداخت در تایید مالی*/
			insert into #R
			select  CashAnalysingID
					,d.SlID		
					,round(#T.Amount * d.Share,2)	Amount
					,round(BaseAmount * d.Share,0)   BaseAmount
					,VoucherID
					,PreVoucherID
					,1
				from #T
				join NOC.VWConfirmStatementItemPortion d
					on d.ConfirmStatementPrePaymentID = #T.ConfirmStatementPrePaymentID	


			/*کسر از پیش پرداخت مبنی بر استهلاک در تایید مالی*/	
			insert into #R
			select  CashAnalysingID
					,d.AdditionDeductionSlID		
					,-1 * #T.Amount 	Amount
					,-1 * BaseAmount   BaseAmount
					,VoucherID
					,null
					,1
				from #T
				join 
				(select ConfirmStatementPrePaymentID,AdditionDeductionSlID
				from NOC.VWConfirmStatementItemPortion 
				group by ConfirmStatementPrePaymentID,AdditionDeductionSlID
				)d
					on d.ConfirmStatementPrePaymentID = #T.ConfirmStatementPrePaymentID	




				
		create table #PayrollPortion
		(
			CalculationPersonelID INT,
			PersonelID INT,
			VoucherID INT,
			SlID INT,
			Share DECIMAL(36, 10)		
		)

		insert into #PayrollPortion
		exec [NOC].SpPayrollPortion


			/*استهلاک مساعده و وام و سایر پرداختهای کاهنده حقوق*/
			insert into #R				
			select  CashAnalysingID
					,d.SlID		
					,round(#T.Amount * d.Share,2)	Amount
					,round(BaseAmount * d.Share ,0)  BaseAmount
					,d.VoucherID
					,null
					,1
				from #T
				join #PayrollPortion d
					on d.CalculationPersonelID = #T.CalculationPersonelID

			/*پرداخت حقوق انفرادی*/
			insert into #R				
			select  CashAnalysingID
					,d.SlID		
					,round(#T.Amount * d.Share,2)	Amount
					,round(BaseAmount * d.Share ,0)  BaseAmount
					,d.VoucherID
					,null
					,1
				from #T 
				join pay.CalculationResult cr on cr.CalculationResultID = #T.PayOfCalculationResult
				join #PayrollPortion d
					on d.CalculationPersonelID = cr.CalculationPersonelID

					
	create table #PayrollCostPortion
	(
	PayPreparingID int,
	PersonelID int,
	VoucherID int,
	SlID int,
	CalculationTypeID int,
	Amount decimal(36,10),
	ShareOfRoundingIsAllowed bit
	)

	insert into #PayrollCostPortion
	exec [NOC].SpPayrollCostPortion
			/*پرداخت حقوق تجمیعی*/	
			insert into #R
			select  CashAnalysingID
					,d.SlID		
					,sum(ROUND((d.Amount/ReportCurrencyRate),2))	Amount
					,sum(d.Amount) BaseAmount
					,d.VoucherID
					,null
					,ShareOfRoundingIsAllowed
				from #T
				join #PayrollCostPortion d
					on d.PayPreparingID = #T.PayPreparingID	
				group by CashAnalysingID,d.SlID,d.VoucherID,ShareOfRoundingIsAllowed

				

		--Share of Rounding in R#
		select  a.* ,
				a.Amount - isnull(b.Amount,0) Diff, 
				a.BaseAmount - isnull(b.BaseAmount,0) BaseDiff
		into #tt
		from #T a
		join 
		(
		select CashAnalysingID,sum(Amount) Amount,sum(BaseAmount) BaseAmount
		from #R a
		left join noc.ReportHeadline b on a.SlID = b.SlID
		where (b.ReportHeadlineID is null or b.HasCashNature = 0)
		group by CashAnalysingID
		)b on a.CashAnalysingID = b.CashAnalysingID
		where (a.Amount <> isnull(b.Amount,0) or a.BaseAmount <> isnull(b.BaseAmount,0))

		select * into #rrr 
		from (
			select  ROW_NUMBER() over(partition by a.CashAnalysingID order by a.BaseAmount desc) Rno,
					a.id			
			from  #R a
			WHERE ShareOfRoundingIsAllowed = 1
			) a where Rno = 1


		update a
		set a.Amount = a.Amount + diff  , 
			a.BaseAmount =  a.BaseAmount + BaseDiff
		from #R a
		join  #rrr b
		on  a.ID = b.ID
		join #tt c on c.CashAnalysingID = a.CashAnalysingID
		
		end

		;WITH cte
		AS (	
				select a.SlID BaseSl,
					   a.BasePrevoucherID,
					   b.VoucherID,
					   c.SlID ModifiedSl,
					   c.ModificationPercent,
					   a.Number,
					   a.PreVoucherID,
					   a.Date,
					   c.ModifiedTopicID,
					   c.BaseCurrencyDebitAccrue - c.BaseCurrencyCreditAccrue BaseCurrencyAccrue,
					   c.BaseCurrencyDebitCash - c.BaseCurrencyCreditCash BaseCurrencyCash

				from noc.Modification a
				join acc.VoucherItem b 
					on a.VoucherItemID = b.VoucherItemID
				join noc.ModifiedTopic c
					on c.ModificationID = a.ModificationID
				join acc.PreVoucher pv
					on pv.PreVoucherID = a.BasePrevoucherID
				where pv.DocumentNumtypeID <> 90

				union all

				select cte.BaseSl,
					   cte.BasePrevoucherID,
					   cte.VoucherID,
					   c.SlID ModifiedSl,
					   c.ModificationPercent,
					   a.Number,
					   a.PreVoucherID,
					   a.Date,
					   cte.ModifiedTopicID,
					   c.BaseCurrencyDebitAccrue - c.BaseCurrencyCreditAccrue BaseCurrencyAccrue,
					   c.BaseCurrencyDebitCash - c.BaseCurrencyCreditCash BaseCurrencyCash
				from noc.Modification a
				join acc.VoucherItem b 
					on a.VoucherItemID = b.VoucherItemID
				join noc.ModifiedTopic c
					on c.ModificationID = a.ModificationID
				join cte on cte.PreVoucherID = a.BasePrevoucherID
					and cte.ModifiedSl = a.SlID
				)

		select BaseSl,
			   BasePrevoucherID,
			   VoucherID,
			   ModifiedSl,
			   ModificationPercent,
			   BaseCurrencyAccrue,
			   BaseCurrencyCash
			into #Modification
		from(
		SELECT RANK() over(partition by ModifiedTopicID order by date desc) Rno,*
		FROM cte )A
		where Rno = 1

		--BEGIN TRANSACTION CashAnalysingTran
		INSERT INTO [NOC].[Analysing]
				   ([ReportagePeriodID]
				   ,[Type]
				   ,[Creator]
				   ,[CreationDate]
				   ,[LastEditor]
				   ,[LastEditionDate]
				   ,[Version]
				   ,CalculatePeriodID)
		select 
					@ReportagePeriodID
					,1
					,@user
					,GETDATE()
					,@user
					,GETDATE()
					,0
					,@ReportagePeriodID
		set @AnalysingID = SCOPE_IDENTITY()

		set identity_insert [NOC].[CashAnalysing] on
		INSERT INTO [NOC].[CashAnalysing]
				   ([CashAnalysingID]
				   ,[AnalysingID]
				   ,[CashDataCollectionID]
				   ,[Status]
				   ,[Creator]
				   ,[CreationDate]
				   ,[LastEditor]
				   ,[LastEditionDate]
				   ,[Version]
				   ,[ReportCurrencyRate]
				   ,[BaseDocumentID]
				   ,[BaseDocumentType]
				   ,[EffectiveDate]
				   ,[RowIndex]
				   ,[DlID])
		select		a.[CashAnalysingID]
				   ,@AnalysingID
				   ,[CashDataCollectionID]
				   ,a.[Status]
					,@user
					,GETDATE()
					,@user
					,GETDATE()
					,0
					,ReportCurrencyRate
					,case when b.PurchaseInvoiceID is not null then b.PurchaseInvoiceID
						  when b.ConfirmStatementID is not null then b.ConfirmStatementID
						  when b.AdditionDeduction is not null then case when csi.ConfirmStatementID is not null then csi.ConfirmStatementID
																		 when csi.PurchaseInvoiceID is not null then csi.PurchaseInvoiceID end
						  when b.ContractStatementID is not null then b.ContractStatementID
						  when b.PayOfCalculationResult is not null then b.PayOfCalculationResult
						  when b.PayPreparingID is not null then  b.PayPreparingID 
						  when b.ConfirmStatementPrePaymentID is not null or b.PurchaseInvoicePrePaymentID  is not null then  BaseOfDepreciation
						  else b.PreVoucherID
					end
					,case when b.PurchaseInvoiceID is not null then 'PurchaseInvoice'
						  when b.ConfirmStatementID is not null then 'ConfirmStatement'
						  when b.AdditionDeduction is not null then case when csi.ConfirmStatementID is not null then 'ConfirmStatement'
																		 when csi.PurchaseInvoiceID is not null then 'PurchaseInvoice' end
						  when b.ContractStatementID is not null then 'ContractStatement'
						  when b.PayOfCalculationResult is not null then 'PayOfCalculationResult'
						  when b.PayPreparingID is not null then 'PayPreparing'
						  when b.ConfirmStatementPrePaymentID is not null then 'ConfirmStatement'
						  when b.PurchaseInvoicePrePaymentID  is not null or b.ConfirmPurchaseInvoiceAdvancePaymentID is not null  then 'PurchaseInvoice'
						  when b.TypeInDateCollected = 'PaymentSubject' then 'DirectPayedCosts_PaymentSubject'
						  when b.TypeInDateCollected = 'DebitCreditNoteItem' then 'DirectPayedCosts_DebitCreditNoteItem'
						  when b.TypeInDateCollected = 'PettyCashCostItem' then 'DirectPayedCosts_PettyCashCostItem'
					end
					,b.Date
					,ROW_NUMBER() over(order by a.[CashAnalysingID])
					,[DlID]
			from #CashAnalysing a
			join #T b on a.CashAnalysingID = b.CashAnalysingID
			left join cnt.ConfirmStatementItem csi 
				   on csi.ConfirmStatementItemID = b.AdditionDeduction
		set identity_insert [NOC].[CashAnalysing] off

		select pii.PurchaseInvoiceID,cs.ContractID
		into #PurchaseInvoice_Contract
		from vnd.PurchaseInvoiceItem pii
		join cnt.ContractSubject cs on cs.ContractSubjectID = pii.ContractSubjectID
		group by pii.PurchaseInvoiceID,cs.ContractID

		update a
		set ContractID = 
				case when b.ContractID is not null then b.ContractID
					 when b.ConfirmStatementID is not null then cs.ContractID
					 when b.AdditionDeduction is not null then csi.ContractID
					 when b.ContractStatementID is not null then co.ContractID
					 when b.PurchaseInvoiceID is not null then pi.ContractID
					 when b.PurchaseInvoicePrePaymentID  is not null then pre1.ContractID
					 when b.ConfirmStatementPrePaymentID is not null then pre2.ContractID
					 end
		from noc.CashAnalysing a
		join #T b on a.CashAnalysingID = b.CashAnalysingID
		left join cnt.confirmstatement cs on cs.ConfirmStatementID = b.ConfirmStatementID
		left join 
		(
			select csi.ConfirmStatementItemID,isnull(cs.ContractID,pi.ContractID) ContractID
			from cnt.confirmstatementitem csi
			left join cnt.confirmstatement cs on csi.ConfirmStatementID = cs.ConfirmStatementID
			left join #PurchaseInvoice_Contract pi on pi.PurchaseInvoiceID = csi.PurchaseInvoiceID
		)csi on csi.ConfirmStatementItemID = b.AdditionDeduction
		left join cnt.ContractStatement co on co.ContractStatementID = b.ContractStatementID
		left join #PurchaseInvoice_Contract pi on pi.PurchaseInvoiceID = b.PurchaseInvoiceID
		left join 
		(
			select pp.PurchaseInvoicePrePaymentID,pi.ContractID
			from vnd.PurchaseInvoicePrePayment pp
			join #PurchaseInvoice_Contract pi on pi.PurchaseInvoiceID = pp.PurchaseInvoiceID
		)pre1 on pre1.PurchaseInvoicePrePaymentID = b.PurchaseInvoicePrePaymentID
		left join 
		(
			select pp.ConfirmStatementPrePaymentID,c.ContractID
			from cnt.ConfirmStatementPrePayment pp
			join cnt.ConfirmStatementitem pi on pi.ConfirmStatementItemID = pp.ConfirmStatementItemID
			join cnt.ConfirmStatement c on c.ConfirmStatementID = pi.ConfirmStatementID
		)pre2 on pre2.ConfirmStatementPrePaymentID = b.ConfirmStatementPrePaymentID

		update ca
		set Status = c.Status 
		from [NOC].[CashAnalysing] ca
		join noc.Analysing a on a.AnalysingID = ca.AnalysingID
		join [NOC].[CashDataCollection] cdc
			on cdc.CashDataCollectionID = ca.CashDataCollectionID
		join [NOC].[CashDataCollection_Temp] c
			on c.ReportagePeriodID = @ReportagePeriodID
			and (
					   cdc.[PaymentSubjectID] = c.[PaymentSubjectID]
					or cdc.[DebitCreditNoteItemID] = c.[DebitCreditNoteItemID]
					or cdc.[PettyCashCostItemID] = c.[PettyCashCostItemID]
					or cdc.ConfirmStatementPrePaymentID = c.ConfirmStatementPrePaymentID
					or cdc.[PurchaseInvoicePrePaymentID] = c.[PurchaseInvoicePrePaymentID]
					or cdc.[CalculationResultID] = c.[CalculationResultID]
					or cdc.[CalculationID] = c.[CalculationID]
					or cdc.ReceiveSubjectID = c.ReceiveSubjectID
					or cdc.ConfirmStatementItemID = c.ConfirmStatementItemID
				)
			and ca.BaseDocumentType = c.BaseDocumentType
			and ca.BaseDocumentID   = c.BaseDocumentID
		where a.ReportagePeriodID = @ReportagePeriodID

		INSERT INTO [NOC].[CashAnalysingItem]
				   ([CashAnalysingID]
				   ,[SlID]
				   ,[Amount]
				   ,[Creator]
				   ,[CreationDate]
				   ,[LastEditor]
				   ,[LastEditionDate]
				   ,[Version]
				   ,BaseCurrencyAmount
				   ,AccrueVoucherID
				   ,AccruePreVoucherID
				   )
			select  CashAnalysingID
					,case when b.BaseSl is null then a.SlID else b.ModifiedSl end
					,case when b.BaseSl is null then a.Amount else round(a.Amount * b.ModificationPercent / 100 , 2) end
					,@user
					,GETDATE()
					,@user
					,GETDATE()
					,0
					,case when b.BaseSl is null then a.BaseAmount else round(a.BaseAmount * b.ModificationPercent / 100 , 0) end
					,AccrueVoucherID
					,AccruePreVoucherID
			from #R a
			left join #Modification b
				on a.SlID = b.BaseSl
				and isnull(a.AccruePreVoucherID,0) = isnull(b.BasePrevoucherID,0)
				and a.AccrueVoucherID = b.VoucherID

		--get transferd record from previous period
		begin
			set @Maxid = isnull((select max(CashAnalysingID) from noc.CashAnalysing),@Maxid)

			select		@Maxid + ROW_NUMBER() over(order by ca.[CashDataCollectionID]) ID
					   ,ca.[CashDataCollectionID]
					   ,case when isnull(c.[Status],0) <> 0 then  c.[Status]
							 when cdc.CalculationResultID is not null then 1
							 else 0 end [Status]
					   ,[ReportCurrencyRate]
					   ,ca.[BaseDocumentID]
					   ,ca.[BaseDocumentType]
					   ,[EffectiveDate]
					   ,[RowIndex]
					   ,[DlID]
					   ,CashAnalysingID PreviousCashAnalysingID
					into #TransferdFromPreviousPeriod
			from [NOC].Analysing a
			join [NOC].CashAnalysing ca
				on a.Analysingid = ca.Analysingid
			join noc.CashDataCollection cdc
				on cdc.CashDataCollectionID = ca.CashDataCollectionID
			left join [NOC].[CashDataCollection_Temp] c
				on c.ReportagePeriodID = @ReportagePeriodID
				and (
					   cdc.[PaymentSubjectID] = c.[PaymentSubjectID]
					or cdc.[DebitCreditNoteItemID] = c.[DebitCreditNoteItemID]
					or cdc.[PettyCashCostItemID] = c.[PettyCashCostItemID]
					or cdc.ConfirmStatementPrePaymentID = c.ConfirmStatementPrePaymentID
					or cdc.[PurchaseInvoicePrePaymentID] = c.[PurchaseInvoicePrePaymentID]
					or cdc.[CalculationResultID] = c.[CalculationResultID]
					or cdc.[CalculationID] = c.[CalculationID]
					or cdc.ReceiveSubjectID = c.ReceiveSubjectID
					or cdc.ConfirmStatementItemID = c.ConfirmStatementItemID
					)
					and ca.BaseDocumentType = c.BaseDocumentType
					and ca.BaseDocumentID = c.BaseDocumentID
			where a.[ReportagePeriodID] = @PreviousPeriod
			and ca.status = 2

			set identity_insert [NOC].[CashAnalysing] on
			INSERT INTO [NOC].[CashAnalysing]
					   ([CashAnalysingID]
					   ,[AnalysingID]
					   ,[CashDataCollectionID]
					   ,[Status]
					   ,[Creator]
					   ,[CreationDate]
					   ,[LastEditor]
					   ,[LastEditionDate]
					   ,[Version]
					   ,[ReportCurrencyRate]
					   ,[BaseDocumentID]
					   ,[BaseDocumentType]
					   ,[EffectiveDate]
					   ,[RowIndex]
					   ,[DlID])
				select
						[ID]
					   ,@AnalysingID
					   ,[CashDataCollectionID]
					   ,[Status]
						,@user
						,GETDATE()
						,@user
						,GETDATE()
					   ,0
					   ,[ReportCurrencyRate]
					   ,[BaseDocumentID]
					   ,[BaseDocumentType]
					   ,[EffectiveDate]
					   ,[RowIndex]
					   ,[DlID]
			from #TransferdFromPreviousPeriod
			set identity_insert [NOC].[CashAnalysing] off

			INSERT INTO [NOC].[CashAnalysingItem]
					   ([CashAnalysingID]
					   ,[SlID]
					   ,[Amount]
					   ,[Creator]
					   ,[CreationDate]
					   ,[LastEditor]
					   ,[LastEditionDate]
					   ,[Version]
					   ,BaseCurrencyAmount
					   ,AccrueVoucherID
					   ,AccruePreVoucherID
					   )
			select
						a.[ID]
					   ,b.SlID
					   ,b.Amount
					   ,@user
					   ,GETDATE()
					   ,@user
					   ,GETDATE()
					   ,0
					   ,b.BaseCurrencyAmount
					   ,b.AccrueVoucherID
					   ,b.AccruePreVoucherID
			from #TransferdFromPreviousPeriod a
			join noc.CashAnalysingItem b on	a.PreviousCashAnalysingID = b.CashAnalysingID
		end

		--Reconcilation Between Cash and Accrue
		begin
			select a.AccrueVoucherID,isnull(a.AccruePreVoucherID,0) AccruePreVoucherID,a.SlID,SUM(a.BaseCurrencyAmount) BaseCurrencyAmount
			into #Cash
			from 
			(
				select  AccrueVoucherID,AccruePreVoucherID,
						case when m.BaseSl is null then SlID else m.ModifiedSl end SlID,
						case when m.BaseSl is null then  BaseCurrencyAmount else BaseCurrencyCash end BaseCurrencyAmount,			
						Amount
				from noc.CashAnalysingItem a
				left join  #Modification m
					on  isnull(m.BasePrevoucherID,0) = isnull(a.AccruePreVoucherID,0)
					and m.BaseSl = a.SlID
					and m.VoucherID = a.AccrueVoucherID
				union all
				select b.LookupDataItemID AccrueVoucherID,null,a.SlID,sum(BaseCurrencyDebit-BaseCurrencyCredit) BaseCurrencyAmount,sum(Debit-credit) Amount 
				from noc.CashFounding a
				left join
				(
				select EntityID,LookupDataItemID 
				from  cfg.EntityCustomeFieldData 
				where EntityCustomeFieldID = 1059
				)b on a.CashFoundingID = b.EntityID
				group by b.LookupDataItemID,SlID	
			) a
			group by AccrueVoucherID,isnull(a.AccruePreVoucherID,0),SlID

			select  VoucherID,
					isnull(PrevoucherID,0) PrevoucherID,
					SlID,
					SUM(BaseCurrencyAmount) BaseCurrencyAmount
			into #Accrue
			from
			(
			select  b.VoucherID,isnull(vp.PrevoucherID,0) PrevoucherID,
					case when m.BaseSl is null then SlID else m.ModifiedSl end SlID,
					case when m.BaseSl is null then  b.Debit-b.Credit else BaseCurrencyAccrue end BaseCurrencyAmount
			from noc.AccrueAnalysing a
			join acc.VoucherItem b
				on a.VoucherItemID = b.VoucherItemID
			left join acc.VoucherPrevoucher vp
				on vp.VoucherItemID = b.VoucherItemID
			left join  #Modification m
				on  isnull(m.BasePrevoucherID,0) = isnull(vp.PrevoucherID,0)
				and m.BaseSl = b.SlID
				and m.VoucherID = b.VoucherID
				)A
			group by VoucherID,SlID,PrevoucherID

			select AccrueVoucherID,AccruePreVoucherID
			into #t222
			from 
			(
			select AccrueVoucherID,AccruePreVoucherID,SUM(BaseCurrencyAmount) BaseCurrencyAmount
			from #Cash
			group by AccrueVoucherID,AccruePreVoucherID
			)a
			join 
			(
			select VoucherID,PrevoucherID,SUM(BaseCurrencyAmount) BaseCurrencyAmount
			from #Accrue 
			group by VoucherID,PrevoucherID
			)b on a.AccrueVoucherID = b.VoucherID and a.AccruePreVoucherID = b.PrevoucherID
			where a.BaseCurrencyAmount = b.BaseCurrencyAmount

			/*Do it temporarily just for pasargad*/

			--update d set SlID = c.SlID
			--from #Cash a
			--join #Accrue c on c.VoucherID = a.AccrueVoucherID and c.PrevoucherID = a.AccruePreVoucherID 
			--join noc.CashAnalysingItem d on d.AccrueVoucherID = a.AccrueVoucherID and isnull(d.AccruePreVoucherID,0) = a.AccruePreVoucherID
			--where d.SlID in (4193,5513)
			--and c.SlID = 5534
			--and 
			--((c.BaseCurrencyAmount > 0 and d.Amount > 0)
			--or
			--(c.BaseCurrencyAmount < 0 and d.Amount < 0)
			--)


			select a.AccrueVoucherID,a.AccruePreVoucherID,a.SlID,a.BaseCurrencyAmount - isnull(c.BaseCurrencyAmount,0) BaseCurrencyDiff
			into #t333
			from #Cash a
			join 
			(select AccrueVoucherID,AccruePreVoucherID
			from #t222
			group by  AccrueVoucherID,AccruePreVoucherID)b on a.AccrueVoucherID = b.AccrueVoucherID and a.AccruePreVoucherID = b.AccruePreVoucherID
			join #Accrue c on c.VoucherID = a.AccrueVoucherID and c.PrevoucherID = a.AccruePreVoucherID and a.SlID = c.SlID
			where a.BaseCurrencyAmount <> c.BaseCurrencyAmount

			select  ROW_NUMBER() over(partition by d.AccrueVoucherID,d.AccruePreVoucherID,d.slid order by d.BaseCurrencyAmount desc) Rno,
					d.CashAnalysingItemID,
					a.BaseCurrencyDiff,
					a.AccrueVoucherID,
					a.AccruePreVoucherID,
					d.CashAnalysingID,
					d.slid
			into #t444
			from #t333 a
			join noc.CashAnalysingItem d on d.AccrueVoucherID = a.AccrueVoucherID and isnull(d.AccruePreVoucherID,0) = a.AccruePreVoucherID and d.SlID = a.SlID
			join #T b on d.CashAnalysingID = b.CashAnalysingID


			update d
			set d.BaseCurrencyAmount = d.BaseCurrencyAmount - a.BaseCurrencyDiff
			from #t444 a
			join noc.CashAnalysingItem d on a.CashAnalysingItemID = d.CashAnalysingItemID
			where a.Rno = 1

			INSERT INTO [NOC].[CashAnalysingItem]
					   ([CashAnalysingID]
					   ,[SlID]
					   ,[Amount]
					   ,[Creator]
					   ,[CreationDate]
					   ,[LastEditor]
					   ,[LastEditionDate]
					   ,[Version]
					   ,BaseCurrencyAmount
					   ,AccrueVoucherID
					   ,AccruePreVoucherID
					   )
			select
						d.[CashAnalysingID]
					   ,a.[SlID]
					   ,0
					   ,@user
					   ,GETDATE()
					   ,@user
					   ,GETDATE()
					   ,0
					   ,-1 * a.BaseCurrencyDiff
					   ,a.AccrueVoucherID
					   ,a.AccruePreVoucherID
			from #t333 a
			join 
			(select CashAnalysingID,AccrueVoucherID,AccruePreVoucherID
			from #t444 
			group by CashAnalysingID,AccrueVoucherID,AccruePreVoucherID)d on d.AccrueVoucherID = a.AccrueVoucherID and d.AccruePreVoucherID = a.AccruePreVoucherID 
			where  a.SlID not in (select SlID from #t444 where AccrueVoucherID = a.AccrueVoucherID and  AccruePreVoucherID = a.AccruePreVoucherID )
		end

		--Must Add in NIOC Config
		Declare @InputID int = 2 
		select StuffID,StuffAccountGroupID
		into #StuffDetail
		from stf.StuffDetail
		
		--Analysing Stock Receipt 
		begin
			
			select PrevoucherID,VoucherID
			into #StockReceiptVoucher
			from acc.VWVoucherPrevoucher
			where EngName = 'StockReceipt'

			declare @MaxCashAnalysingID int

			select @MaxCashAnalysingID = max(CashAnalysingID)
			from noc.CashAnalysing

			declare @MaxRowIndex int

			select @MaxRowIndex = max(RowIndex)
			from noc.CashAnalysing
			where AnalysingID = @AnalysingID

			-- In Purchase Type
			begin
			select 
				*,
				convert (float ,a.Price) / convert (float ,sum(a.Price) over(partition by a.PurchaseInvoiceID)) ShareOfPayment
			into #StockReceiptDetail
			from(
				SELECT  a.PurchaseInvoiceID,
						a.StockReceiptID,
						sag.InventorySlID,
						sdtsd.SlID PurchaseControlSlID,
						sr.PreVoucherID,
						sr.Date,
						SUM(sri.Price) Price
				FROM stc.StockReceipt_PurchaseInvoice a
				join stc.StockReceiptItem sri 
					on sri.StockReceiptItemID = a.StockReceiptItemID
				join stc.StockReceipt sr
					on sr.StockReceiptID = sri.StockReceiptID			
				JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
					ON sr.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
				join #StuffDetail v 
					on v.stuffid = sri.StuffID
				join stf.Stock stc 
					on sr.StockID = stc.StockID
				join stf.StuffAccountGroupAccountSL sag
					on v.StuffAccountGroupID = sag.StuffAccountGroupID
						and stc.StockTypeID = sag.StockTypeID
				join stf.StockDocumentTypeSlDl sdtsd
					on sdtsd.StuffAccountGroupID = v.StuffAccountGroupID
					and sdtsd.StockDocumentTypeID = sdtb.StockDocumentTypeID
				where sr.Date < = @EndDate and sri.Price > 0 
				group by a.PurchaseInvoiceID,a.StockReceiptID,sag.InventorySlID,sdtsd.SlID ,sr.PreVoucherID,sr.Date
				)a

			select  a.PurchaseInvoiceID,
					a.StockReceiptID,
					a.PurchaseControlSlID,
					a.InventorySlID,
					b.CashAnalysingID,
					b.CashDataCollectionID,
					b.ReportCurrencyRate,
					b.AnalysingID,
					case when b.EffectiveDate > a.Date then b.EffectiveDate else a.Date end EffectiveDate,
					b.DlID,
					d.PrevoucherID AccruePreVoucherID,
					d.VoucherID AccrueVoucherID,
					ROW_NUMBER() over(order by a.StockReceiptID) + @MaxCashAnalysingID ID,
					ROW_NUMBER() over(order by a.StockReceiptID) + @MaxRowIndex RowIndex,
					a.ShareOfPayment
			into #StockReceipt
			from #StockReceiptDetail a
			join #StockReceiptVoucher d
				on d.PrevoucherID = a.PreVoucherID
			join [NOC].[CashAnalysing] b
				on b.BaseDocumentType = 'PurchaseInvoice'
				and b.BaseDocumentID = a.PurchaseInvoiceID
			left join [NOC].[CashAnalysing] c
				on  c.CashDataCollectionID = b.CashDataCollectionID
				and c.BaseDocumentType = 'StockReceipt'
				and c.BaseDocumentID = a.StockReceiptID
			where c.CashAnalysingID is null	

			set identity_insert [NOC].[CashAnalysing] on
			INSERT INTO [NOC].[CashAnalysing]
					   ([CashAnalysingID]
					   ,[AnalysingID]
					   ,[CashDataCollectionID]
					   ,[Status]
					   ,[Creator]
					   ,[CreationDate]
					   ,[LastEditor]
					   ,[LastEditionDate]
					   ,[Version]
					   ,[ReportCurrencyRate]
					   ,[BaseDocumentID]
					   ,[BaseDocumentType]
					   ,[EffectiveDate]
					   ,[RowIndex]
					   ,[DlID])
				select
						[ID]
					   ,@AnalysingID
					   ,[CashDataCollectionID]
					   ,0
						,@user
						,GETDATE()
						,@user
						,GETDATE()
					   ,0
					   ,[ReportCurrencyRate]
					   ,StockReceiptID
					   ,'StockReceipt'
					   ,[EffectiveDate]
					   ,[RowIndex]
					   ,[DlID]
				from #StockReceipt
			set identity_insert [NOC].[CashAnalysing] off

			INSERT INTO [NOC].[CashAnalysingItem]
					   ([CashAnalysingID]
					   ,[SlID]
					   ,[Amount]
					   ,[Creator]
					   ,[CreationDate]
					   ,[LastEditor]
					   ,[LastEditionDate]
					   ,[Version]
					   ,BaseCurrencyAmount
					   ,AccrueVoucherID
					   ,AccruePreVoucherID
					   )
			select
						a.[ID]
					   ,a.InventorySlID
					   ,b.Amount * ShareOfPayment
					   ,@user
					   ,GETDATE()
					   ,@user
					   ,GETDATE()
					   ,0
					   ,b.BaseCurrencyAmount * ShareOfPayment
					   ,a.AccrueVoucherID
					   ,a.AccruePreVoucherID
			from #StockReceipt a
			join  [NOC].[CashAnalysingItem] b
				on a.CashAnalysingID = b.CashAnalysingID
				and b.SlID = a.PurchaseControlSlID

			INSERT INTO [NOC].[CashAnalysingItem]
					   ([CashAnalysingID]
					   ,[SlID]
					   ,[Amount]
					   ,[Creator]
					   ,[CreationDate]
					   ,[LastEditor]
					   ,[LastEditionDate]
					   ,[Version]
					   ,BaseCurrencyAmount
					   ,AccrueVoucherID
					   ,AccruePreVoucherID
					   )
			select
						a.[ID]
					   ,a.PurchaseControlSlID
					   ,-1 * b.Amount * ShareOfPayment
					   ,@user
					   ,GETDATE()
					   ,@user
					   ,GETDATE()
					   ,0
					   ,-1 * b.BaseCurrencyAmount * ShareOfPayment
					   ,a.AccrueVoucherID
					   ,a.AccruePreVoucherID
			from #StockReceipt a
			join  [NOC].[CashAnalysingItem] b
				on a.CashAnalysingID = b.CashAnalysingID
				and b.SlID = a.PurchaseControlSlID
			end

			--In Transfer Type
			begin


				select @MaxCashAnalysingID = max(CashAnalysingID)
				from noc.CashAnalysing

				select @MaxRowIndex = max(RowIndex)
				from noc.CashAnalysing
				where AnalysingID = @AnalysingID


				select 
				*,
				convert (float ,a.Price) / convert (float ,sum(a.Price) over(partition by a.SourceStockReceiptID)) ShareOfPayment
				into #TransferDetail
				from
				(
					select sri.StockReceiptID SourceStockReceiptID,t.StockReceiptID DestinationStockReceiptID,sag.InventorySlID InvSlId1,sag2.InventorySlID InvSlId2,t.PreVoucherID,t.Date,SUM(ti.Price) Price
					from stc.StockReceipt t
					JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
						ON t.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
					join stc.StockReceiptItem ti on t.StockReceiptID = ti.StockReceiptID
					join stc.StockReceiptItemTrace tit on ti.StockReceiptItemID = tit.StockReceiptItemID and tit.TraceID = @InputID
					join stc.StockReceiptItemTrace srit on srit.TraceID = @InputID and srit.Value = tit.Value and tit.StockReceiptItemTraceID <> srit.StockReceiptItemTraceID
					join stc.StockReceiptItem sri on sri.StockReceiptItemID = srit.StockReceiptItemID and sri.StuffID = ti.StuffID
					join #StuffDetail v 
						on v.stuffid = sri.StuffID
					JOIN STF.Stock s 
						ON t.StockID = s.StockID
					JOIN STF.Stock sd 
						ON t.DeliverStockID = sd.StockID
					join stf.StuffAccountGroupAccountSl sag
						on sag.StuffAccountGroupID = v.StuffAccountGroupID 
						AND s.StockTypeID = sag.StockTypeID
					join stf.StuffAccountGroupAccountSl sag2
						on sag.StuffAccountGroupID = v.StuffAccountGroupID 
						AND sd.StockTypeID = sag2.StockTypeID
					where t.Date <= @EndDate and ti.Price > 0
					group by sri.StockReceiptID,t.StockReceiptID,sag.InventorySlID,sag2.InventorySlID,t.PreVoucherID,t.Date
					)a

				select  a.DestinationStockReceiptID,
						a.InvSlId2,
						a.InvSlId1,
						b.CashAnalysingID,
						b.CashDataCollectionID,
						b.ReportCurrencyRate,
						b.AnalysingID,
						case when b.EffectiveDate > a.Date then b.EffectiveDate else a.Date end EffectiveDate,
						b.DlID,
						d.PrevoucherID AccruePreVoucherID,
						d.VoucherID AccrueVoucherID,
						ROW_NUMBER() over(order by a.SourceStockReceiptID) + @MaxCashAnalysingID ID,
						ROW_NUMBER() over(order by a.SourceStockReceiptID) + @MaxRowIndex RowIndex,
						ShareOfPayment
				into #Transfer
				from #TransferDetail a
				join #StockReceiptVoucher d
					on d.PrevoucherID = a.PreVoucherID
				join [NOC].[CashAnalysing] b
					on b.BaseDocumentType = 'StockReceipt'
					and b.BaseDocumentID = a.SourceStockReceiptID
				left join [NOC].[CashAnalysing] c
					on  c.CashDataCollectionID = b.CashDataCollectionID
					and c.BaseDocumentType = 'StockReceipt'
					and c.BaseDocumentID = a.DestinationStockReceiptID
				where c.CashAnalysingID is null	

				set identity_insert [NOC].[CashAnalysing] on
				INSERT INTO [NOC].[CashAnalysing]
						   ([CashAnalysingID]
						   ,[AnalysingID]
						   ,[CashDataCollectionID]
						   ,[Status]
						   ,[Creator]
						   ,[CreationDate]
						   ,[LastEditor]
						   ,[LastEditionDate]
						   ,[Version]
						   ,[ReportCurrencyRate]
						   ,[BaseDocumentID]
						   ,[BaseDocumentType]
						   ,[EffectiveDate]
						   ,[RowIndex]
						   ,[DlID])
					select
							[ID]
						   ,@AnalysingID
						   ,[CashDataCollectionID]
						   ,0
							,@user
							,GETDATE()
							,@user
							,GETDATE()
						   ,0
						   ,[ReportCurrencyRate]
						   ,DestinationStockReceiptID
						   ,'StockReceipt'
						   ,[EffectiveDate]
						   ,[RowIndex]
						   ,[DlID]
					from #Transfer
				set identity_insert [NOC].[CashAnalysing] off

				INSERT INTO [NOC].[CashAnalysingItem]
						   ([CashAnalysingID]
						   ,[SlID]
						   ,[Amount]
						   ,[Creator]
						   ,[CreationDate]
						   ,[LastEditor]
						   ,[LastEditionDate]
						   ,[Version]
						   ,BaseCurrencyAmount
						   ,AccrueVoucherID
						   ,AccruePreVoucherID
						   )
				select
							a.[ID]
						   ,a.InvSlId1
						   ,b.Amount * ShareOfPayment
						   ,@user
						   ,GETDATE()
						   ,@user
						   ,GETDATE()
						   ,0
						   ,b.BaseCurrencyAmount * ShareOfPayment
						   ,a.AccrueVoucherID
						   ,a.AccruePreVoucherID
				from #Transfer a
				join  [NOC].[CashAnalysingItem] b
					on a.CashAnalysingID = b.CashAnalysingID
					and b.SlID = a.InvSlId2


				INSERT INTO [NOC].[CashAnalysingItem]
						   ([CashAnalysingID]
						   ,[SlID]
						   ,[Amount]
						   ,[Creator]
						   ,[CreationDate]
						   ,[LastEditor]
						   ,[LastEditionDate]
						   ,[Version]
						   ,BaseCurrencyAmount
						   ,AccrueVoucherID
						   ,AccruePreVoucherID
						   )
				select
							a.[ID]
						   ,a.InvSlId2
						   ,-1 * b.Amount * ShareOfPayment
						   ,@user
						   ,GETDATE()
						   ,@user
						   ,GETDATE()
						   ,0
						   ,-1 * b.BaseCurrencyAmount * ShareOfPayment
						   ,a.AccrueVoucherID
						   ,a.AccruePreVoucherID
				from #Transfer a
				join  [NOC].[CashAnalysingItem] b
					on a.CashAnalysingID = b.CashAnalysingID
					and b.SlID = a.InvSlId2
			end

		end

		--Analysing Outgoing
		begin

			select PrevoucherID,VoucherID
			into #OutgoingVoucher
			from acc.VWVoucherPrevoucher
			where EngName = 'Outgoing'

			select @MaxCashAnalysingID = max(CashAnalysingID)
			from noc.CashAnalysing

			select @MaxRowIndex = max(RowIndex)
			from noc.CashAnalysing
			where AnalysingID = @AnalysingID

			select 
			*,
			convert (float ,a.Price) / convert (float ,sum(a.Price) over(partition by a.StockReceiptID)) ShareOfPayment
			into #OutgoingDetail
			from
			(
				select sri.StockReceiptID,o.OutgoingID,sag.InventorySlID,sdtsd.SlID CostSlID,o.PreVoucherID,o.Date,SUM(oi.Price) Price
				from stc.Outgoing o
				JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
					ON o.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
				join stc.StockDocumentType sdt on sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
				join stc.OutgoingItem oi on o.OutgoingID = oi.OutgoingID
				join stc.OutgoingItemTrace oit on oi.OutgoingItemID = oit.OutgoingItemID and oit.TraceID = @InputID
				join stc.StockReceiptItemTrace srit on srit.TraceID = @InputID and srit.Value = oit.Value
				join stc.StockReceiptItem sri on sri.StockReceiptItemID = srit.StockReceiptItemID and sri.StuffID = oi.StuffID
				join #StuffDetail v 
					on v.stuffid = sri.StuffID
				JOIN STF.Stock s 
					ON o.StockID = s.StockID
				join stf.StuffAccountGroupAccountSl sag
					on sag.StuffAccountGroupID = v.StuffAccountGroupID 
					AND s.StockTypeID = sag.StockTypeID
				join stf.StockDocumentTypeSlDl sdtsd
					on sdtsd.StuffAccountGroupID = v.StuffAccountGroupID
					and sdtsd.StockDocumentTypeID = sdtb.StockDocumentTypeID
					and (sdtsd.DlID is null or sdtsd.DlID = o.DeliverDlID)
				where o.Date <= @EndDate and oi.Price > 0 and sdt.DocumentType = 2 
				group by sri.StockReceiptID,o.OutgoingID,sag.InventorySlID,sdtsd.SlID ,o.PreVoucherID,o.Date
				)a

			select  a.OutgoingID,
					a.CostSlID,
					a.InventorySlID,
					b.CashAnalysingID,
					b.CashDataCollectionID,
					b.ReportCurrencyRate,
					b.AnalysingID,
					case when b.EffectiveDate > a.Date then b.EffectiveDate else a.Date end EffectiveDate,
					b.DlID,
					d.PrevoucherID AccruePreVoucherID,
					d.VoucherID AccrueVoucherID,
					ROW_NUMBER() over(order by a.StockReceiptID) + @MaxCashAnalysingID ID,
					ROW_NUMBER() over(order by a.StockReceiptID) + @MaxRowIndex RowIndex,
					ShareOfPayment
			into #Outgoing
			from #OutgoingDetail a
			join #OutgoingVoucher d
				on d.PrevoucherID = a.PreVoucherID
			join [NOC].[CashAnalysing] b
				on b.BaseDocumentType = 'StockReceipt'
				and b.BaseDocumentID = a.StockReceiptID
			left join [NOC].[CashAnalysing] c
				on  c.CashDataCollectionID = b.CashDataCollectionID
				and c.BaseDocumentType = 'Outgoing'
				and c.BaseDocumentID = a.OutgoingID
			where c.CashAnalysingID is null	

			set identity_insert [NOC].[CashAnalysing] on
			INSERT INTO [NOC].[CashAnalysing]
					   ([CashAnalysingID]
					   ,[AnalysingID]
					   ,[CashDataCollectionID]
					   ,[Status]
					   ,[Creator]
					   ,[CreationDate]
					   ,[LastEditor]
					   ,[LastEditionDate]
					   ,[Version]
					   ,[ReportCurrencyRate]
					   ,[BaseDocumentID]
					   ,[BaseDocumentType]
					   ,[EffectiveDate]
					   ,[RowIndex]
					   ,[DlID])
				select
						[ID]
					   ,@AnalysingID
					   ,[CashDataCollectionID]
					   ,0
						,@user
						,GETDATE()
						,@user
						,GETDATE()
					   ,0
					   ,[ReportCurrencyRate]
					   ,OutgoingID
					   ,'Outgoing'
					   ,[EffectiveDate]
					   ,[RowIndex]
					   ,[DlID]
				from #Outgoing 
			set identity_insert [NOC].[CashAnalysing] off

			INSERT INTO [NOC].[CashAnalysingItem]
					   ([CashAnalysingID]
					   ,[SlID]
					   ,[Amount]
					   ,[Creator]
					   ,[CreationDate]
					   ,[LastEditor]
					   ,[LastEditionDate]
					   ,[Version]
					   ,BaseCurrencyAmount
					   ,AccrueVoucherID
					   ,AccruePreVoucherID
					   )
			select
						a.[ID]
					   ,a.CostSlID
					   ,b.Amount * ShareOfPayment
					   ,@user
					   ,GETDATE()
					   ,@user
					   ,GETDATE()
					   ,0
					   ,b.BaseCurrencyAmount * ShareOfPayment
					   ,a.AccrueVoucherID
					   ,a.AccruePreVoucherID
			from #Outgoing a
			join  [NOC].[CashAnalysingItem] b
				on a.CashAnalysingID = b.CashAnalysingID
				and b.SlID = a.InventorySlID


			INSERT INTO [NOC].[CashAnalysingItem]
					   ([CashAnalysingID]
					   ,[SlID]
					   ,[Amount]
					   ,[Creator]
					   ,[CreationDate]
					   ,[LastEditor]
					   ,[LastEditionDate]
					   ,[Version]
					   ,BaseCurrencyAmount
					   ,AccrueVoucherID
					   ,AccruePreVoucherID
					   )
			select
						a.[ID]
					   ,a.InventorySlID
					   ,-1 * b.Amount * ShareOfPayment
					   ,@user
					   ,GETDATE()
					   ,@user
					   ,GETDATE()
					   ,0
					   ,-1 * b.BaseCurrencyAmount * ShareOfPayment
					   ,a.AccrueVoucherID
					   ,a.AccruePreVoucherID
			from #Outgoing a
			join  [NOC].[CashAnalysingItem] b
				on a.CashAnalysingID = b.CashAnalysingID
				and b.SlID = a.InventorySlID
		end

		--Analysing Returned Outgoing
		begin

			select PrevoucherID,VoucherID
			into #ReturnedOutgoingVoucher
			from acc.VWVoucherPrevoucher
			where EngName = 'ReturnedOutgoing'

			select @MaxCashAnalysingID = max(CashAnalysingID)
			from noc.CashAnalysing

			select @MaxRowIndex = max(RowIndex)
			from noc.CashAnalysing
			where AnalysingID = @AnalysingID

			select 
			*,
			convert (float ,a.Price) / convert (float ,sum(a.Price) over(partition by a.OutgoingID)) ShareOfPayment
			into #ReturnedOutgoingDetail
			from
			(
				select sri.OutgoingID,o.ReturnedOutgoingID,sag.InventorySlID,sdtsd.SlID CostSlID,o.PreVoucherID,o.Date,SUM(oi.Price) Price
				from stc.ReturnedOutgoing o
				JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
					ON o.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
				join stc.StockDocumentType sdt on sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
				join stc.ReturnedOutgoingItem oi on o.ReturnedOutgoingID = oi.ReturnedOutgoingID
				join stc.ReturnedOutgoingItemTrace oit on oi.ReturnedOutgoingItemID = oit.ReturnedOutgoingItemID and oit.TraceID = @InputID
				join stc.OutgoingItemTrace srit on srit.TraceID = @InputID and srit.Value = oit.Value
				join stc.OutgoingItem sri on sri.OutgoingItemID = srit.OutgoingItemID and sri.StuffID = oi.StuffID
				join #StuffDetail v 
					on v.stuffid = sri.StuffID
				JOIN STF.Stock s 
					ON o.StockID = s.StockID
				join stf.StuffAccountGroupAccountSl sag
					on sag.StuffAccountGroupID = v.StuffAccountGroupID 
					AND s.StockTypeID = sag.StockTypeID
				join stf.StockDocumentTypeSlDl sdtsd
					on sdtsd.StuffAccountGroupID = v.StuffAccountGroupID
					and sdtsd.StockDocumentTypeID = sdtb.StockDocumentTypeID
					and (sdtsd.DlID is null or sdtsd.DlID = o.DlDeliverID)
				where o.Date <= @EndDate and oi.Price > 0 and sdt.DocumentType = 2 
				group by sri.OutgoingID,o.ReturnedOutgoingID,sag.InventorySlID,sdtsd.SlID ,o.PreVoucherID,o.Date
				)a

			select  a.ReturnedOutgoingID,
					a.CostSlID,
					a.InventorySlID,
					b.CashAnalysingID,
					b.CashDataCollectionID,
					b.ReportCurrencyRate,
					b.AnalysingID,
					case when b.EffectiveDate > a.Date then b.EffectiveDate else a.Date end EffectiveDate,
					b.DlID,
					d.PrevoucherID AccruePreVoucherID,
					d.VoucherID AccrueVoucherID,
					ROW_NUMBER() over(order by a.OutgoingID) + @MaxCashAnalysingID ID,
					ROW_NUMBER() over(order by a.OutgoingID) + @MaxRowIndex RowIndex,
					ShareOfPayment
			into #ReturnedOutgoing
			from #ReturnedOutgoingDetail a
			join #ReturnedOutgoingVoucher d
				on d.PrevoucherID = a.PreVoucherID
			join [NOC].[CashAnalysing] b
				on b.BaseDocumentType = 'Outgoing'
				and b.BaseDocumentID = a.OutgoingID
			left join [NOC].[CashAnalysing] c
				on  c.CashDataCollectionID = b.CashDataCollectionID
				and c.BaseDocumentType = 'ReturnedOutgoing'
				and c.BaseDocumentID = a.ReturnedOutgoingID
			where c.CashAnalysingID is null	

			set identity_insert [NOC].[CashAnalysing] on
			INSERT INTO [NOC].[CashAnalysing]
					   ([CashAnalysingID]
					   ,[AnalysingID]
					   ,[CashDataCollectionID]
					   ,[Status]
					   ,[Creator]
					   ,[CreationDate]
					   ,[LastEditor]
					   ,[LastEditionDate]
					   ,[Version]
					   ,[ReportCurrencyRate]
					   ,[BaseDocumentID]
					   ,[BaseDocumentType]
					   ,[EffectiveDate]
					   ,[RowIndex]
					   ,[DlID])
				select
						[ID]
					   ,@AnalysingID
					   ,[CashDataCollectionID]
					   ,0
						,@user
						,GETDATE()
						,@user
						,GETDATE()
					   ,0
					   ,[ReportCurrencyRate]
					   ,ReturnedOutgoingID
					   ,'ReturnedOutgoing'
					   ,[EffectiveDate]
					   ,[RowIndex]
					   ,[DlID]
				from #ReturnedOutgoing 
			set identity_insert [NOC].[CashAnalysing] off

			INSERT INTO [NOC].[CashAnalysingItem]
					   ([CashAnalysingID]
					   ,[SlID]
					   ,[Amount]
					   ,[Creator]
					   ,[CreationDate]
					   ,[LastEditor]
					   ,[LastEditionDate]
					   ,[Version]
					   ,BaseCurrencyAmount
					   ,AccrueVoucherID
					   ,AccruePreVoucherID
					   )
			select
						a.[ID]
					   ,a.InventorySlID 
					   ,-1 * b.Amount * ShareOfPayment
					   ,@user
					   ,GETDATE()
					   ,@user
					   ,GETDATE()
					   ,0
					   ,-1 * b.BaseCurrencyAmount * ShareOfPayment
					   ,a.AccrueVoucherID
					   ,a.AccruePreVoucherID
			from #ReturnedOutgoing a
			join  [NOC].[CashAnalysingItem] b
				on a.CashAnalysingID = b.CashAnalysingID
				and b.SlID = a.InventorySlID

			INSERT INTO [NOC].[CashAnalysingItem]
					   ([CashAnalysingID]
					   ,[SlID]
					   ,[Amount]
					   ,[Creator]
					   ,[CreationDate]
					   ,[LastEditor]
					   ,[LastEditionDate]
					   ,[Version]
					   ,BaseCurrencyAmount
					   ,AccrueVoucherID
					   ,AccruePreVoucherID
					   )
			select
						a.[ID]
					   ,a.CostSlID
					   , b.Amount * ShareOfPayment
					   ,@user
					   ,GETDATE()
					   ,@user
					   ,GETDATE()
					   ,0
					   ,b.BaseCurrencyAmount * ShareOfPayment
					   ,a.AccrueVoucherID
					   ,a.AccruePreVoucherID
			from #ReturnedOutgoing a
			join  [NOC].[CashAnalysingItem] b
				on a.CashAnalysingID = b.CashAnalysingID
				and b.SlID = a.InventorySlID
		end

		--Delete Inappropriate Data
		begin
			delete a 
			from [NOC].[CashAnalysingItem] a
			join [NOC].[CashAnalysing] b 
				on a.CashAnalysingID = b.CashAnalysingID
			left join noc.ReportHeadline c
				on c.SlID = a.SlID
			where c.SlID is null
			and b.AnalysingID = @AnalysingID

			delete a
			from [NOC].[CashAnalysing] a
			left join [NOC].[CashAnalysingItem] b
				on a.CashAnalysingID = b.CashAnalysingID
			where b.CashAnalysingItemID is null
			and a.AnalysingID = @AnalysingID

			declare @DataCollectionID int
			select @DataCollectionID = DataCollectionID
			from noc.DataCollection
			where Type = 1
			and ReportagePeriodID = @ReportagePeriodID

			delete from noc.CashDataCollection
			where DataCollectionID = @DataCollectionID
			and CashDataCollectionID not in
			(
			select CashDataCollectionID from noc.CashAnalysing 
			)
		end
		--COMMIT TRANSACTION CashAnalysingTran

	exec NOC.spGetCashInformation @AnalysingID
END TRY
BEGIN CATCH

	DECLARE @ErrorMessage NVARCHAR(4000);
	DECLARE @ErrorSeverity INT;
	DECLARE @ErrorState INT;

	SELECT 
		@ErrorMessage = ERROR_MESSAGE(),
		@ErrorSeverity = ERROR_SEVERITY(),
		@ErrorState = ERROR_STATE();
	
		--ROLLBACK TRANSACTION CashAnalysingTran

	RAISERROR (@ErrorMessage, -- Message text.
			   @ErrorSeverity, -- Severity.
			   @ErrorState -- State.
			   );
				   
END CATCH
