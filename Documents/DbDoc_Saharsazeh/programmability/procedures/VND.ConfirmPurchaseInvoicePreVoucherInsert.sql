
CREATE   PROCEDURE [VND].ConfirmPurchaseInvoicePreVoucherInsert
	@ConfirmPurchaseInvoiceID NVARCHAR(MAX)
--WITH ENCRYPTION 
	 AS      
	 	-----------------------------Declare Parameters--------------------------------	
	DECLARE @DocumentNumTypeId INT = (SELECT  DNT.DocumentNumTypeID
									FROM   CFG.DocumentNumType DNT
									WHERE  DNT.EngName = 'ConfirmPurchaseInvoice'),
	        @MDEntity INT = (select Top 1 Id from mdt.DmdEntity AS de where Name = 'ConfirmPurchaseInvoice'),
			@MaxPrevoucherID int,
			@BaseDigit	DECIMAL(18,4),
	        @Culture   VARCHAR(10),
			@CultureNo int,
			@CreatorId int,
			@HeaderDescription  nvarchar(max),
			@HeaderDescription2 nvarchar(max),
			@AdditionDescription nvarchar(max),
			@AdditionDescription2 nvarchar(max),
			@DeductionDescription nvarchar(max),
			@DeductionDescription2 nvarchar(max),
			@PayableAccountsVsStatementAndAdditionDescription nvarchar(max),
			@PayableAccountsVsStatementAndAdditionDescription2 nvarchar(max),
			@PayableAccountsVsDeductionDescription  nvarchar(max),
			@PayableAccountsVsDeductionDescription2  nvarchar(max),
			@PayableAccountsVsPrepaymentDescription  nvarchar(max),
			@PayableAccountsVsPrepaymentDescription2  nvarchar(max),
			@PrepaymentDescription  nvarchar(max),
			@PrepaymentDescription2  nvarchar(max),
			@AllocationSharingDescription nvarchar(max),
			@AllocationSharingDescription2 nvarchar(max),
			@ExchangeManner TINYINT, --1=GainOrLoss  2=Cost
			@PurchaseInvoicePrevoucherMode BIT,
			@TaxDescription nvarchar(max),
			@TaxDescription2 nvarchar(max),
			@DutyDescription nvarchar(max),
			@DutyDescription2 nvarchar(max),
			@PurchaseInvoiceItemsDescription nvarchar(max),
			@PurchaseInvoiceItemsDescription2 nvarchar(max),
			@PayableAccountsVsVat nvarchar(max),
			@PayableAccountsVsVat2 nvarchar(max)

		

	SELECT @PurchaseInvoicePrevoucherMode = case when c.ConfigValue = 'true' then 1 else 0 end
	FROM   cfg.Configuration AS c
	WHERE  c.ConfigKey = 'PurchasePrevoucherIsNet'

	SELECT @ExchangeManner = c.ConfigValue
	FROM   cfg.Configuration AS c
	WHERE  c.ConfigKey = 'ExchangeManner'
	
	SET @ExchangeManner = isnull(@ExchangeManner,1)
	
	SET @CreatorId = cfg.GetuserID();
	SET @Culture = cfg.GetuserCulture();

	select @CultureNo = CultureNo
	from cfg.CultureInfo
	where Culture = @Culture
	
	SELECT [value] ID
	INTO #DocumentIds
	FROM   cfg.R_FnCommaStr2Table(@ConfirmPurchaseInvoiceID) 

	set @BaseDigit = cfg.GetBaseCurrencyPrecision();

	    
	select  @HeaderDescription = Description,
			@HeaderDescription2 = Description2
	from CFG.[VoucherDescription] 
	where MDEntityID = @MDEntity and [Key] = 'Header'

	select  @AdditionDescription = Description,
			@AdditionDescription2 = Description2
	from CFG.[VoucherDescription] 
	where MDEntityID = @MDEntity and [Key] = 'Additions'

	select  @DeductionDescription = Description,
			@DeductionDescription2 = Description2
	from CFG.[VoucherDescription] 
	where MDEntityID = @MDEntity and [Key] = 'Deductions'

	select  @PayableAccountsVsDeductionDescription = Description,
			@PayableAccountsVsDeductionDescription2 = Description2
	from CFG.[VoucherDescription] 
	where MDEntityID = @MDEntity and [Key] = 'PayableAccountsVsDeduction'

	select  @PayableAccountsVsPrepaymentDescription = Description,
			@PayableAccountsVsPrepaymentDescription2 = Description2
	from CFG.[VoucherDescription] 
	where MDEntityID = @MDEntity and [Key] = 'PayableAccountsVsPrepayment'

	select  @PurchaseInvoiceItemsDescription = Description,
			@PurchaseInvoiceItemsDescription2 = Description2
	from CFG.[VoucherDescription] 
	where MDEntityID = @MDEntity and [Key] = 'PurchaseInvoiceItems'

	select  @TaxDescription = Description,
			@TaxDescription2 = Description2
	from CFG.[VoucherDescription] 
	where MDEntityID = @MDEntity and [Key] = 'Tax'

	select  @DutyDescription = Description,
			@DutyDescription2 = Description2
	from CFG.[VoucherDescription] 
	where MDEntityID = @MDEntity and [Key] = 'Duty'

	select  @PayableAccountsVsStatementAndAdditionDescription = Description,
			@PayableAccountsVsStatementAndAdditionDescription2 = Description2
	from CFG.[VoucherDescription] 
	where MDEntityID = @MDEntity and [Key] = 'PayableAccountsVsConfirmPurchaseInvoiceAndAddition'

	select  @PayableAccountsVsVat = Description,
			@PayableAccountsVsVat2 = Description2
	from CFG.[VoucherDescription] 
	where MDEntityID = @MDEntity and [Key] = 'PayableAccountsVsVat'

	select  @PrepaymentDescription = Description,
			@PrepaymentDescription2 = Description2
	from CFG.[VoucherDescription] 
	where MDEntityID = @MDEntity and [Key] = 'Prepayment'

	select  @AllocationSharingDescription = Description,
			@AllocationSharingDescription2 = Description2
	from CFG.[VoucherDescription] 
	where MDEntityID = @MDEntity and [Key] = 'AllocationSharing'


	select @MaxPrevoucherID = max(PreVoucherID)
	from acc.PreVoucher
                           


	;with cte as
	(
	        SELECT  cs.PurchaseInvoiceID,
	                b.DLID
	        FROM  VND.ConfirmPurchaseInvoice cs 
			JOIN #DocumentIds ids on ids.ID = CS.ConfirmPurchaseInvoiceID
			join VND.PurchaseInvoiceItem pii on pii.PurchaseInvoiceID = cs.PurchaseInvoiceID
			left join stc.StockReceiptItem sri 
				on sri.StockReceiptItemID = pii.StockReceiptItemID
	        JOIN cnt.vwContractSubject a
	            ON  isnull(pii.ContractSubjectID,sri.ContractSubjectID) = a.ContractSubjectID 
	        JOIN cnt.Contract b
	            ON  a.ContractID = b.ContractID
	        GROUP BY
	                cs.PurchaseInvoiceID,
	                b.DLID

			union

	        SELECT  cs.PurchaseInvoiceID,
	                b.PurchaseOrderDlID
	        FROM  VND.ConfirmPurchaseInvoice cs 
			JOIN #DocumentIds ids on ids.ID = CS.ConfirmPurchaseInvoiceID
			join VND.PurchaseInvoiceItem pii on pii.PurchaseInvoiceID = cs.PurchaseInvoiceID
			join VND.vwPurchaseContractFlow a 
				on a.PurchaseInvoiceItemID = pii.PurchaseInvoiceItemID
	        JOIN vnd.PurchaseContract b
	            ON  a.PurchaseContractID = b.PurchaseContractID
	        GROUP BY
	                cs.PurchaseInvoiceID,
	                b.PurchaseOrderDlID

	)
		
	SELECT  isnull(@MaxPrevoucherID,0) + ROW_NUMBER() over(order by cs.ConfirmPurchaseInvoiceID) PrevoucherID,
			cs.ConfirmPurchaseInvoiceID,
			Currency.CurrencyID,
	        c.CurrencyRate,
	        dl.DlID PartyDLID,
	        c.BranchID,
	        dl.Title PartyTitle, 
			dl.Title2 PartyTitle2,
		    Currency.ExchangeUnit,
			IsBaseCurrencyBasis,
		    cs.PurchaseInvoiceID,
		    cs.Date,
			f.FinancialPeriodID,
	        t.SlID PayableAccountSlId,
		   cs.Number ContractStatementNumber,
		   t.PurchaseTypeID,
		   t.TaxSLID  ,
		   t.DutySLID,
		   c.Type,
		   case when @CultureNo = 1 then t.Title else t.Title2 end ContractStatementTypeTitle,
		   cast(null as varchar(max)) ErrorMessage,
		   @HeaderDescription HeaderDescription,
		   @HeaderDescription2 HeaderDescription2,
		   cs.Number,
		   cs.Amount,
		   dd.FullDateAlternateKey,
		   dd.PersianFullDateAlternateKey,
		   @PayableAccountsVsStatementAndAdditionDescription PayableAccountsVsStatementAndAdditionDescription,
		   @PayableAccountsVsStatementAndAdditionDescription2 PayableAccountsVsStatementAndAdditionDescription2,
		   @PayableAccountsVsDeductionDescription PayableAccountsVsDeductionDescription,
		   @PayableAccountsVsDeductionDescription2 PayableAccountsVsDeductionDescription2,
		   @PayableAccountsVsPrepaymentDescription PayableAccountsVsPrepaymentDescription,
		   @PayableAccountsVsPrepaymentDescription2 PayableAccountsVsPrepaymentDescription2,
		   @AllocationSharingDescription AllocationSharingDescription,
		   @AllocationSharingDescription2 AllocationSharingDescription2,
		   @PayableAccountsVsVat PayableAccountsVsVat,
		   @PayableAccountsVsVat2 PayableAccountsVsVat2,
		   t.SlID,
		   @TaxDescription TaxDescription,
		   @TaxDescription2 TaxDescription2,
		   @DutyDescription DutyDescription,
		   @DutyDescription2 DutyDescription2		,
		   --c.DlID,
		   cte.DLID ContractDLID,
		   DD1.FullDateAlternateKey InvoiceDate_FullDateAlternateKey,
		   DD1.PersianFullDateAlternateKey InvoiceDate_PersianFullDateAlternateKey,
		   c.InvoiceNumber,
		   ISNULL(c.InvoiceDate,c.[Date]) PurchaseInvoiceDate
		into #ConfirmPurchaseInvoice
	FROM   VND.ConfirmPurchaseInvoice cs 
	join VND.PurchaseInvoice c on c.PurchaseInvoiceID = cs.PurchaseInvoiceID
	join VND.PurchaseType t
		on t.PurchaseTypeID = c.Type
	join acc.dl on dl.DLID = c.DlID
	join cfg.Currency  on Currency.CurrencyID = c.CurrencyID
	JOIN #DocumentIds ids on ids.ID = CS.ConfirmPurchaseInvoiceID
	JOIN cfg.DimDate DD on DD.Date = CS.Date
	left JOIN cfg.DimDate DD1 on DD1.Date = c.InvoiceDate
	join cfg.FinancialPeriod  f on cs.Date between f.StartDate and f.EndDate
	LEFT JOIN cte ON  cte.PurchaseInvoiceID = c.PurchaseInvoiceID
		
	update #ConfirmPurchaseInvoice 
	set ErrorMessage = ErrorMessage +  N'PayableAccountSlNotSpecifiedInContractStatementType^'+ ContractStatementTypeTitle +char(10)+char(13)
	where PayableAccountSlId is null

	if exists (select * from #ConfirmPurchaseInvoice where ErrorMessage is not null )
	BEGIN	
		select ConfirmPurchaseInvoiceID,ErrorMessage from #ConfirmPurchaseInvoice
		RETURN;
	END


	----Get TItem
	    SELECT CASE 
	    	        WHEN s.type = 1 THEN sd.SlID
	    	        ELSE sagpt.SlID
	    	    END               Slid,
	    	    s.[Type]       AS StuffType,
	    	    s.Code         AS StuffCode,
	    	    It.Price - It.Discount net,
	    	    CASE 
	    	        WHEN IsBaseCurrencyBasis = 0 THEN 
					ROUND((It.Price - It.Discount) * currencyrate / ExchangeUnit, @BaseDigit)
	    	        WHEN IsBaseCurrencyBasis = 1 THEN 
					ROUND((It.Price - It.Discount) * ExchangeUnit / currencyrate, @BaseDigit)
	    	    END               NetInBaseCurrency,
	    	    -- ارزش افزوده (مالیات و عوارض) فقط به ارز پایه ثبت می‌شود؛ پس بدون تبدیل نرخ ارز استفاده می‌شود
	    	    case when it.IsVatPartOfCost = 1 then 0 else ISNULL(It.Tax,0) end TaxInBaseCurrency,
	    	    case when it.IsVatPartOfCost = 1 then 0 else ISNULL(It.Duty,0) end DutyInBaseCurrency,
	    	    case when it.IsVatPartOfCost = 1 then ISNULL(It.Tax,0) + ISNULL(It.Duty,0) else 0 end VatPartOfCostInBaseCurrency,
	    	    ISNULL(It.Tax,0) + ISNULL(It.Duty,0) VatInBaseCurrency,
	    	    isnull(AllocationSharingAmount,0) AllocationSharingAmount,
	    	    sag.ExchangeSlId,
				REPLACE(
				REPLACE(
					@PurchaseInvoiceItemsDescription,
					'@@StuffTitleAndService@@',s.Title),
					'@@InvoiceItemDescription@@',ISNULL(it.[Description],'')) 
					AS PurchaseInvoiceItemsDescription,
				REPLACE(
				REPLACE(
					@PurchaseInvoiceItemsDescription2,
					'@@StuffTitleAndService@@',s.Title2),
					'@@InvoiceItemDescription@@',ISNULL(it.[Description2],'')) 
					PurchaseInvoiceItemsDescription2,
				h.PurchaseInvoiceID,
				h.PrevoucherID,
				h.CurrencyID,
				h.CurrencyRate,
				PurchaseInvoiceItemID,
				ConfirmPurchaseInvoiceID,
				It.Price  - It.Discount Amount
	    INTO   #TItem
	    FROM   vnd.purchaseInvoiceItem It
		INNER JOIN #ConfirmPurchaseInvoice h on h.PurchaseInvoiceID = It.PurchaseInvoiceID
	    INNER JOIN STF.VWStuff s
	    	ON  it.StuffID = s.StuffID
	    INNER JOIN stf.StuffDetail sd
	    	ON  s.StuffID = sd.StuffID
	    LEFT JOIN stf.StuffAccountGroup sag
	    	ON  sd.StuffAccountGroupID = sag.StuffAccountGroupID
	    LEFT JOIN stf.StuffAccountGroupPurchaseType sagpt
	    	ON  sagpt.StuffAccountGroupID = sag.StuffAccountGroupID
	    	AND sagpt.PurchaseTypeID = h.PurchaseTypeID

		update a 
		set ErrorMessage = isnull(ErrorMessage,'') +
						   case when StuffType = 0 then  'PurchaseControlSlNotSpecified^' + StuffCode
						        when StuffType = 1 then  'CostSlInServiceNotSpecified^' + StuffCode
						   end +char(10)+char(13)
		from #ConfirmPurchaseInvoice a
		join #Titem b on a.PurchaseInvoiceID = b.PurchaseInvoiceID
		where b.SlId is null

		if exists (select * from #ConfirmPurchaseInvoice where ErrorMessage is not null )
		BEGIN	
			select PurchaseInvoiceID,ErrorMessage from #ConfirmPurchaseInvoice
			RETURN;
	    END

		---Get Additions
		select  cs.ConfirmPurchaseInvoiceItemID,
				m.SlID,
				cs.Addition,
					case
						when h.IsBaseCurrencyBasis = 0
							then ROUND(Addition * currencyrate / ExchangeUnit , @BaseDigit)
						when IsBaseCurrencyBasis = 1
							then ROUND(Addition *ExchangeUnit / currencyrate, @BaseDigit)
						end AdditionInBaseCurrency,
				h.PrevoucherID,
				h.ConfirmPurchaseInvoiceID,
				H.CurrencyID,
				H.CurrencyRate,
				REPLACE(
				REPLACE(
						@AdditionDescription, 
						'@@ConfirmPurchaseInvoiceItemDescription@@',ISNULL(cs.Description,'')), 
						'@@RowDescription@@',ISNULL(cs.Description,'')) 
						AdditionDescription,
				REPLACE(
				REPLACE(
						@AdditionDescription2, 
						'@@ConfirmPurchaseInvoiceItemDescription@@',ISNULL(cs.Description2,'')), 
						'@@RowDescription@@',ISNULL(cs.Description2,'')) 
						AdditionDescription2
		into #Additions
		from VND.ConfirmPurchaseInvoiceItem cs 
		join cnt.AdditionDeductionType adt 
			on adt.AdditionDeductionTypeID = cs.AdditionDeductionTypeID
		join cnt.AdditionDeductionTypeMethod m
			on m.AdditionDeductionTypeMethodID = cs.AdditionDeductionTypeMethodID
		join #ConfirmPurchaseInvoice h on h.ConfirmPurchaseInvoiceID = cs.ConfirmPurchaseInvoiceID
		where adt.Type = 1 
	
		--get AdditionSum
		SELECT ConfirmPurchaseInvoiceID,
			   SUM(AdditionInBaseCurrency)     AdditionInBaseCurrency,
			   SUM(Addition)                   Addition
		INTO   #AdditionsSum
		FROM   #Additions
			   group by ConfirmPurchaseInvoiceID
	
		---Get Deduction
		select  cs.ConfirmPurchaseInvoiceItemID,
				m.SlID,
				cs.Deduction,
					case
						when h.IsBaseCurrencyBasis = 0
							then ROUND(cs.Deduction * h.CurrencyRate / h.ExchangeUnit , @BaseDigit)
						when IsBaseCurrencyBasis = 1
							then ROUND(cs.Deduction *h.ExchangeUnit / h.CurrencyRate, @BaseDigit)
						end DeductionInBaseCurrency,
				h.PrevoucherID,
				h.ConfirmPurchaseInvoiceID,
				h.CurrencyID,
				h.CurrencyRate,
				REPLACE(
				REPLACE(
						@DeductionDescription, 
						'@@ConfirmPurchaseInvoiceItemDescription@@',ISNULL(cs.Description,'')), 
						'@@RowDescription@@',ISNULL(cs.Description,'')) 
						DeductionDescription,
				REPLACE(
				REPLACE(
						@DeductionDescription2, 
						'@@ConfirmPurchaseInvoiceItemDescription@@',ISNULL(cs.Description2,'')), 
						'@@RowDescription@@',ISNULL(cs.Description2,'')) 
						DeductionDescription2
			into #Deduction
		from VND.ConfirmPurchaseInvoiceItem cs 
		join cnt.AdditionDeductionType adt 
			on adt.AdditionDeductionTypeID = cs.AdditionDeductionTypeID
		join cnt.AdditionDeductionTypeMethod m
			on m.AdditionDeductionTypeMethodID = cs.AdditionDeductionTypeMethodID
		left join VND.ConfirmPurchaseInvoiceItem csd on cs.ConfirmPurchaseInvoiceItemID = csd.ConfirmPurchaseInvoiceItemID 
		join #ConfirmPurchaseInvoice h on h.ConfirmPurchaseInvoiceID = cs.ConfirmPurchaseInvoiceID
		where adt.Type = 2 and adt.Criterion = 1
	
		SELECT ConfirmPurchaseInvoiceID,
			   SUM(DeductionInBaseCurrency)     DeductionInBaseCurrency,
			   SUM(Deduction)                   Deduction
		INTO   #DeductionSum
		FROM   #deduction
		GROUP BY
			   ConfirmPurchaseInvoiceID
	
	
		---Get Prepayment
		select  a.ConfirmPurchaseInvoiceAdvancePaymentID,
				m.SlID,
				a.Price,
					case
					when h.IsBaseCurrencyBasis = 0
						then ROUND(a.Price * 
						case when a.PaymentSubjectID is not null then ps.CurrencyRate
								when a.DebitCreditNoteItemID is not null then dcni.CurrencyRate
						end
						/ h.ExchangeUnit , @BaseDigit)
					when h.IsBaseCurrencyBasis = 1
						then ROUND(a.Price * h.ExchangeUnit / 
						case when a.PaymentSubjectID is not null then ps.CurrencyRate
								when a.DebitCreditNoteItemID is not null then dcni.CurrencyRate							
						end							, @BaseDigit)
					end PriceInBaseCurrency,
				case when a.PaymentSubjectID is not null then ps.CurrencyRate
						when a.DebitCreditNoteItemID is not null then dcni.CurrencyRate
				end	 CurrencyRate,
				b.AllocationSharingAmount,
				m.ExchangeGainLossSlID,
				@PrepaymentDescription Description,
				@PrepaymentDescription Description2,
				h.PrevoucherID,
				h.ConfirmPurchaseInvoiceID,
				h.CurrencyID
		into #ConfirmStatementPrePayment
		from vnd.ConfirmPurchaseInvoiceAdvancePayment a
		join VND.ConfirmPurchaseInvoiceItem b
			on a.ConfirmPurchaseInvoiceItemID = b.ConfirmPurchaseInvoiceItemID
		join cnt.AdditionDeductionTypeMethod m
			on m.AdditionDeductionTypeMethodID = b.AdditionDeductionTypeMethodID
		left join fin.PaymentSubject ps
			on ps.PaymentSubjectID = a.PaymentSubjectID
		left join cfg.DebitCreditNoteItem dcni
			on dcni.DebitCreditNoteItemID = a.DebitCreditNoteItemID
		join #ConfirmPurchaseInvoice h 
			on h.ConfirmPurchaseInvoiceID = b.ConfirmPurchaseInvoiceID

		SELECT ConfirmPurchaseInvoiceID,
			   SUM(price)                   Price,
			   SUM(PriceInBaseCurrency)   PriceInBaseCurrency,
			   SUM(PriceInBaseCurrency) + SUM(AllocationSharingAmount) PriceInBaseCurrencyWithConfirmStatementRate
		INTO   #ConfirmStatementPrePaymentSum
		FROM   #ConfirmStatementPrePayment
		GROUP BY ConfirmPurchaseInvoiceID

	    -----------------------------------insert in prevoucher------------------
		set identity_insert [ACC].[PreVoucher] on
	    INSERT INTO [ACC].[PreVoucher](PreVoucherId,[BranchID],[DocumentNumtypeID],[Date],[FinancialPeriodID],[Description],[Description2],[Creator],[CreationDate],[LastEditor],[LastEditionDate],[Version])
		SELECT PreVoucherId,BranchId,@DocumentNumTypeId,date,FinancialPeriodID,HeaderDescription,HeaderDescription2,@CreatorId,GETDATE(),@CreatorId,GETDATE(),0
	    from #ConfirmPurchaseInvoice
	    set identity_insert [ACC].[PreVoucher] off

	    UPDATE a
	    SET    PreVoucherID = b.PreVoucherId
		from VND.ConfirmPurchaseInvoice  a
		join #ConfirmPurchaseInvoice b on a.ConfirmPurchaseInvoiceID = b.ConfirmPurchaseInvoiceID

	    -----------------------------------insert PurchaseControl------------------
	    INSERT INTO acc.PreVoucherItem
	    	(
	    	PreVoucherID,
	    	RowIndex,
	    	SlID,
	    	[Description],
	    	Description2,
	    	Debit,
	    	Credit,
	    	CurrencyID,
	    	CurrencyRate,
	    	CurrencyDebit,
	    	CurrencyCredit,
	    	IsAutoGenerated,
	    	Creator,
	    	CreationDate,
	    	LastEditor,
	    	LastEditionDate,
	    	Version,
			BaseDocumentName,
			BaseDocumentID
	    	)
	    SELECT PreVoucherID,
	    	    1,
	    	    a.SlID,
	    	    ISNULL(PurchaseInvoiceItemsDescription,''),
	    	    ISNULL(PurchaseInvoiceItemsDescription2,''), 
				NetInBaseCurrency + case when b.HasCurrency = 1 then 0 else VatPartOfCostInBaseCurrency end,
	    	    0,
	    	    case when b.HasCurrency = 1 then CurrencyId else -1 end,
	    	    case when b.HasCurrency = 1 then currencyrate else 1 end,
				case when b.HasCurrency = 1 then net else NetInBaseCurrency + VatPartOfCostInBaseCurrency end,
	    	    0,
	    	    1,
	    	    @CreatorId,
	    	    GETDATE(),
	    	    @CreatorId,
	    	    GETDATE(),
	    	    0,
				'PurchaseInvoiceItem',
				PurchaseInvoiceItemID
	    FROM   #TItem a
		left join acc.sl b on a.Slid = b.SlID	 

	    -----------------------------------VAT part of cost (currency accounts)------------------
	    -- ارزش افزوده بخشی از بها فقط به ارز پایه است؛ برای حسابهای ارزی در ردیف جداگانه (بدون ارز) ثبت می‌شود
	    INSERT INTO acc.PreVoucherItem
	    	(
	    	PreVoucherID,
	    	RowIndex,
	    	SlID,
	    	[Description],
	    	Description2,
	    	Debit,
	    	Credit,
	    	CurrencyID,
	    	CurrencyRate,
	    	CurrencyDebit,
	    	CurrencyCredit,
	    	IsAutoGenerated,
	    	Creator,
	    	CreationDate,
	    	LastEditor,
	    	LastEditionDate,
	    	Version,
			BaseDocumentName,
			BaseDocumentID
	    	)
	    SELECT PreVoucherID,
	    	    1,
	    	    a.SlID,
	    	    ISNULL(PurchaseInvoiceItemsDescription,''),
	    	    ISNULL(PurchaseInvoiceItemsDescription2,''),
				VatPartOfCostInBaseCurrency,
	    	    0,
	    	    -1,
	    	    1,
				VatPartOfCostInBaseCurrency,
	    	    0,
	    	    1,
	    	    @CreatorId,
	    	    GETDATE(),
	    	    @CreatorId,
	    	    GETDATE(),
	    	    0,
				'PurchaseInvoiceItem',
				PurchaseInvoiceItemID
	    FROM   #TItem a
		join acc.sl b on a.Slid = b.SlID
		where b.HasCurrency = 1
		  and a.VatPartOfCostInBaseCurrency <> 0
		
	    -----------------------------------AccountsPayable insert vs PurchaseControl------------------
		if @PurchaseInvoicePrevoucherMode = 0
		begin
			INSERT INTO acc.PreVoucherItem
				(
				PreVoucherID,
				RowIndex,
				SlID,
				[Description],
				Description2,
				Debit,
				Credit,
				CurrencyID,
				CurrencyRate,
				CurrencyDebit,
				CurrencyCredit,
				IsAutoGenerated,
				Creator,
				CreationDate,
				LastEditor,
				LastEditionDate,
				Version,
				BaseDocumentName,
				BaseDocumentID
				)
			select
				PreVoucherId,
				1,
				b.SlID,
				ISNULL(PayableAccountsVsStatementAndAdditionDescription,''),
				ISNULL(PayableAccountsVsStatementAndAdditionDescription2,''),
				0,
				NetInBaseCurrency,
				CurrencyId,
				currencyrate,
				0,
				Net,
				1,
				@CreatorId,
				GETDATE(),
				@CreatorId,
				GETDATE(),
				0,
				'PurchaseInvoice',
				b.PurchaseInvoiceID
			from  
			(
			select  PurchaseInvoiceID,SUM(Net) Net,SUM(NetInBaseCurrency) NetInBaseCurrency
			from #TItem
			group by PurchaseInvoiceID
			)a
			join #ConfirmPurchaseInvoice b on a.PurchaseInvoiceID = b.PurchaseInvoiceID	
			where NetInBaseCurrency <> 0
		end
	    -------------------------------insert Tax--------------------------------
	    INSERT INTO ACC.PreVoucherItem
	        (
	        PreVoucherID,
	        RowIndex,
	        SlID,
	        DESCRIPTION,
	        Description2,
	        Debit,
	        Credit,
	        CurrencyID,
	        CurrencyRate,
	        CurrencyDebit,
	        CurrencyCredit,
	        Creator,
	        CreationDate,
	        LastEditor,
	        LastEditionDate,
	        Version,
			BaseDocumentName,
			BaseDocumentID
	        )
	    SELECT PreVoucherId,
	            1,
	            TaxSlID,
	            ISNULL(TaxDescription,''),
	            ISNULL(TaxDescription2,''),
	            TaxInBaseCurrency,
	            0,
	            -1,
	            1,
	            TaxInBaseCurrency,
	            0,
	            @CreatorId,
	            GETDATE(),
	            @CreatorId,
	            GETDATE(),
	            0,
				'PurchaseInvoice',
				b.PurchaseInvoiceID
	    from  
		(
		select PurchaseInvoiceID,sum(TaxInBaseCurrency) TaxInBaseCurrency
		from #TItem
		group by PurchaseInvoiceID
		)a
		join #ConfirmPurchaseInvoice b on a.PurchaseInvoiceID = b.PurchaseInvoiceID
		where TaxInBaseCurrency <> 0

	    -------------------------------insert Duty--------------------------------	   
	    INSERT INTO ACC.PreVoucherItem
	        (
	        PreVoucherID,
	        RowIndex,
	        SlID,
	        DESCRIPTION,
	        Description2,
	        Debit,
	        Credit,
	        CurrencyID,
	        CurrencyRate,
	        CurrencyDebit,
	        CurrencyCredit,
	        Creator,
	        CreationDate,
	        LastEditor,
	        LastEditionDate,
	        Version,
			BaseDocumentName,
			BaseDocumentID
	        )
	    SELECT  PreVoucherId,
	            1,
	            DutySlId,
	            ISNULL(DutyDescription,''),
	            ISNULL(DutyDescription2,''),
	            DutyInBaseCurrency,
	            0,
	            -1,
	            1,
	            DutyInBaseCurrency,
	            0,
	            @CreatorId,
	            GETDATE(),
	            @CreatorId,
	            GETDATE(),
	            0,
				'PurchaseInvoice',
				b.PurchaseInvoiceID
	    from  
		(
		select PurchaseInvoiceID,sum(DutyInBaseCurrency) DutyInBaseCurrency
		from #TItem
		group by PurchaseInvoiceID
		)a
		join #ConfirmPurchaseInvoice b on a.PurchaseInvoiceID = b.PurchaseInvoiceID
		where DutyInBaseCurrency <> 0
	    -----------------------------------AccountsPayable insert vs VAT ------------------
		if @PurchaseInvoicePrevoucherMode = 0
	    INSERT INTO acc.PreVoucherItem
	        (
	        PreVoucherID,
	        RowIndex,
	        SlID,
	        [Description],
	        Description2,
	        Debit,
	        Credit,
	        CurrencyID,
	        CurrencyRate,
	        CurrencyDebit,
	        CurrencyCredit,
	        IsAutoGenerated,
	        Creator,
	        CreationDate,
	        LastEditor,
	        LastEditionDate,
	        Version,
			BaseDocumentName,
			BaseDocumentID
	        )
	    select
	        PreVoucherId,
	        1,
	        b.SlID,
	        ISNULL(PayableAccountsVsVat,''),
	        ISNULL(PayableAccountsVsVat2,''),
	        0,
			VatInBaseCurrency ,
	        -1,
	        1,
	        0,
			VatInBaseCurrency,
	        1,
	        @CreatorId,
	        GETDATE(),
	        @CreatorId,
	        GETDATE(),
	        0,
			'PurchaseInvoice',
			b.PurchaseInvoiceID
	    from  
		(
		select  PurchaseInvoiceID, SUM(VatInBaseCurrency) VatInBaseCurrency
		from #TItem
		group by PurchaseInvoiceID
		)a
		join #ConfirmPurchaseInvoice b on a.PurchaseInvoiceID = b.PurchaseInvoiceID	
		where  VatInBaseCurrency <> 0
		-----------------------------------insert Additions------------------
		INSERT INTO ACC.PreVoucherItem
	        (
	        PreVoucherID,
	        RowIndex,
	        SlID,
	        DESCRIPTION,
	        Description2,
	        Debit,
	        Credit,
	        CurrencyID,
	        CurrencyRate,
	        CurrencyDebit,
	        CurrencyCredit,
	        Creator,
	        CreationDate,
	        LastEditor,
	        LastEditionDate,
	        Version,
			BaseDocumentName,
			BaseDocumentID
	        )
	    SELECT  PreVoucherId,
	            1,
	            SlID,				
	            ISNULL(AdditionDescription,''),
	            ISNULL(AdditionDescription2,''),
	            AdditionInBaseCurrency,
	            0,
	            CurrencyId,
	            currencyrate,
	            Addition,
	            0,
	            @CreatorId,
	            GETDATE(),
	            @CreatorId,
	            GETDATE(),
	            0,
				'ConfirmStatementItem',
				ConfirmPurchaseInvoiceItemID
		from #Additions
		-----------------------------------AccountsPayable insert For Additions ------------------
		if @PurchaseInvoicePrevoucherMode = 0
		INSERT INTO acc.PreVoucherItem
				( PreVoucherID,
				RowIndex,
				SlID,
				[Description],
				Description2,
				Debit,
				Credit,
				CurrencyID,
				CurrencyRate,
				CurrencyDebit,
				CurrencyCredit,
				IsAutoGenerated,
				Creator,
				CreationDate,
				LastEditor,
				LastEditionDate,
				Version,
				BaseDocumentName,
				BaseDocumentID
				)
			select
				a.PrevoucherID,
				1,
				a.PayableAccountSlId,
				ISNULL(a.PayableAccountsVsStatementAndAdditionDescription,' '),
				ISNULL(a.PayableAccountsVsStatementAndAdditionDescription2,' '),
				0 Debit,
				b.AdditionInBaseCurrency Credit,
				a.CurrencyID,
				a.CurrencyRate,
				0 CurrencyDebit,
				b.Addition CurrencyCredit,
				1,
				@CreatorId,
				GETDATE(),
				@CreatorId,
				GETDATE(),
				0,
				'ConfirmStatement',
				a.ConfirmPurchaseInvoiceID
			from #ConfirmPurchaseInvoice a
			JOIN #AdditionsSum B ON a.ConfirmPurchaseInvoiceID = b.ConfirmPurchaseInvoiceID
			WHERE b.AdditionInBaseCurrency > 0
		-----------------------------------insert Debit Of Payable Accounts For Deductions------------------
		if @PurchaseInvoicePrevoucherMode = 0
		INSERT INTO acc.PreVoucherItem
				( PreVoucherID,
				RowIndex,
				SlID,
				[Description],
				Description2,
				Debit,
				Credit,
				CurrencyID,
				CurrencyRate,
				CurrencyDebit,
				CurrencyCredit,
				IsAutoGenerated,
				Creator,
				CreationDate,
				LastEditor,
				LastEditionDate,
				Version,
				BaseDocumentName,
				BaseDocumentID
				)
			select 
				a.PrevoucherID,
				1,
				a.PayableAccountSlId,		
				ISNULL(a.PayableAccountsVsDeductionDescription,' '),
				ISNULL(a.PayableAccountsVsDeductionDescription2,' '),
				b.DeductionInBaseCurrency,
				0,
				a.CurrencyID,
				a.CurrencyRate,
				b.Deduction,
				0,
				1,
				@CreatorId,
				GETDATE(),
				@CreatorId,
				GETDATE(),
				0,
				'ConfirmStatement',
				a.ConfirmPurchaseInvoiceID
			from #ConfirmPurchaseInvoice a
			join #DeductionSum b on a.ConfirmPurchaseInvoiceID = b.ConfirmPurchaseInvoiceID

		-----------------------------------insert Deduction------------------
	    INSERT INTO ACC.PreVoucherItem
	          (
	            PreVoucherID,
	            RowIndex,
	            SlID,
	            DESCRIPTION,
	            Description2,
	            Debit,
	            Credit,
	            CurrencyID,
	            CurrencyRate,
	            CurrencyDebit,
	            CurrencyCredit,
	            Creator,
	            CreationDate,
	            LastEditor,
	            LastEditionDate,
	            Version,
				BaseDocumentName,
				BaseDocumentID
	          )
	        SELECT PreVoucherId,
	               1,
	               SlID,	
				   ISNULL(DeductionDescription,''),
				   ISNULL(DeductionDescription,''),
	               0,
	               DeductionInBaseCurrency,
	               CurrencyId,
	               currencyrate,
	               0,
	               Deduction,
	               @CreatorId,
	               GETDATE(),
	               @CreatorId,
	               GETDATE(),
	               0,
				   'ConfirmStatementItem',
				   ConfirmPurchaseInvoiceItemID
			from #Deduction
		-----------------------------------insert Debit Of Payable Accounts For Prepayment------------------
		if @PurchaseInvoicePrevoucherMode = 0
		INSERT INTO acc.PreVoucherItem
	          ( PreVoucherID,
	            RowIndex,
	            SlID,
	            [Description],
	            Description2,
	            Debit,
	            Credit,
	            CurrencyID,
	            CurrencyRate,
	            CurrencyDebit,
	            CurrencyCredit,
	            IsAutoGenerated,
	            Creator,
	            CreationDate,
	            LastEditor,
	            LastEditionDate,
	            Version,
				BaseDocumentName,
				BaseDocumentID
	          )
	      SELECT a.PrevoucherID,
	             1,
	             a.PayableAccountSlId,	
				 ISNULL(a.PayableAccountsVsPrepaymentDescription,' '),
				 ISNULL(a.PayableAccountsVsPrepaymentDescription2,' '),  	             
	             PriceInBaseCurrencyWithConfirmStatementRate,
	             0,
	             a.CurrencyID,
	             a.CurrencyRate,
	             b.Price,
	             0,
	             1,
	             @CreatorId,
	             GETDATE(),
	             @CreatorId,
	             GETDATE(),
	             0,
	             'ConfirmStatement',
	             a.ConfirmPurchaseInvoiceID
	      FROM   #ConfirmPurchaseInvoice a
	      JOIN cfg.Currency h
	                  ON  h.CurrencyID = a.CurrencyID
	      JOIN #ConfirmStatementPrePaymentSum b
	                  ON  a.ConfirmPurchaseInvoiceID = b.ConfirmPurchaseInvoiceID
		-----------------------------------insert prepayment------------------
	    INSERT INTO ACC.PreVoucherItem
	          (
	            PreVoucherID,
	            RowIndex,
	            SlID,	
	            DESCRIPTION,
	            Description2,
	            Debit,
	            Credit,
	            CurrencyID,
	            CurrencyRate,
	            CurrencyDebit,
	            CurrencyCredit,
	            Creator,
	            CreationDate,
	            LastEditor,
	            LastEditionDate,
	            Version,
				BaseDocumentName,
				BaseDocumentID
	          )
	        SELECT PreVoucherId,
	               1,
	               SlID,
				   ISNULL(Description,' '),
				   ISNULL(Description2,' '),	               
	               0,
	               PriceInBaseCurrency,
	               CurrencyId,
	               currencyrate,
	               0,
	               Price,
	               @CreatorId,
	               GETDATE(),
	               @CreatorId,
	               GETDATE(),
	               0,
				   'ConfirmPurchaseInvoiceAdvancePayment',
				   ConfirmPurchaseInvoiceAdvancePaymentID
			from #ConfirmStatementPrePayment
		-----------------------------------insert AllocationSharingAmount------------------
		update h
		set ErrorMessage = 'ExchangeGainLossSlIDIsNotSpecifiedInAdditionDeduction' + h.ContractStatementTypeTitle +char(10)+char(13)
	    FROM  VND.ConfirmPurchaseInvoiceItem a
		join cnt.AdditionDeductionTypeMethod b on a.AdditionDeductionTypeMethodID = b.AdditionDeductionTypeMethodID
		join #ConfirmPurchaseInvoice h on h.ConfirmPurchaseInvoiceID = a.ConfirmPurchaseInvoiceID
		where a.AllocationSharingAmount <> 0
		and b.ExchangeGainLossSlID is null
		and @ExchangeManner = 1
		
			
		
		if exists (select * from #ConfirmPurchaseInvoice where ErrorMessage is not null )
		BEGIN	
			select ConfirmPurchaseInvoiceID,ErrorMessage from #ConfirmPurchaseInvoice
			RETURN;
		END
		if @ExchangeManner = 1 
		begin
			INSERT INTO acc.PreVoucherItem
			  (
				PreVoucherID,
				RowIndex,
				SlID,
				[Description],
				Description2,
				Debit,
				Credit,
				CurrencyID,
				CurrencyRate,
				CurrencyDebit,
				CurrencyCredit,
				IsAutoGenerated,
				Creator,
				CreationDate,
				LastEditor,
				LastEditionDate,
				Version
			  )
			SELECT 
				h.PrevoucherID,
				1,
				b.ExchangeGainLossSlID,
				ISNULL(h.AllocationSharingDescription,' '),
				ISNULL(h.AllocationSharingDescription2,' '),
				case when a.AllocationSharingAmount < 0 then abs(a.AllocationSharingAmount) else 0 end,
				case when a.AllocationSharingAmount > 0 then abs(a.AllocationSharingAmount) else 0 end,
				-1,
				1,
				case when a.AllocationSharingAmount < 0 then abs(a.AllocationSharingAmount) else 0 end,
				case when a.AllocationSharingAmount > 0 then abs(a.AllocationSharingAmount) else 0 end,
				1,
				@CreatorId,
				GETDATE(),
				@CreatorId,
				GETDATE(),
				1
			FROM  VND.ConfirmPurchaseInvoiceItem a
			join cnt.AdditionDeductionTypeMethod b on a.AdditionDeductionTypeMethodID = b.AdditionDeductionTypeMethodID
			join #ConfirmPurchaseInvoice h on h.ConfirmPurchaseInvoiceID = a.ConfirmPurchaseInvoiceID
			where a.AllocationSharingAmount <> 0
		end
		if @ExchangeManner = 2
		begin

			select  h.PrevoucherID,
					a.ConfirmPurchaseInvoiceID,
					a.ConfirmPurchaseInvoiceItemID,
					AllocationSharingDescription,
					AllocationSharingDescription2,
					b.SlID,
					round((convert (float ,b.Amount) / convert (float ,sum(b.amount) over(partition by b.ConfirmPurchaseInvoiceID))) 
						* a.AllocationSharingAmount , @BaseDigit) AllocationSharingAmount,
					ROW_NUMBER() over(partition by a.ConfirmPurchaseInvoiceItemID order by b.PurchaseInvoiceItemID) Rno,
					h.CurrencyId
			into #T
			FROM  VND.ConfirmPurchaseInvoiceItem a
			join #TItem b on a.ConfirmPurchaseInvoiceID = b.ConfirmPurchaseInvoiceID
			join #ConfirmPurchaseInvoice h on h.ConfirmPurchaseInvoiceID = a.ConfirmPurchaseInvoiceID
			where a.AllocationSharingAmount <> 0

			;with cte as
			(
			select a.ConfirmPurchaseInvoiceItemID,a.AllocationSharingAmount - b.SumAllocationSharingAmount diff
			from VND.ConfirmPurchaseInvoiceItem a
			join (
					select ConfirmPurchaseInvoiceItemID,sum(AllocationSharingAmount) SumAllocationSharingAmount
					from #T
					group by ConfirmPurchaseInvoiceItemID
				 )b
				 on a.ConfirmPurchaseInvoiceItemID = b.ConfirmPurchaseInvoiceItemID
			where a.AllocationSharingAmount <> b.SumAllocationSharingAmount
			)
			update #t
			set AllocationSharingAmount = AllocationSharingAmount + diff
			from cte
			join #T on cte.ConfirmPurchaseInvoiceItemID = #T.ConfirmPurchaseInvoiceItemID and #T.Rno = 1


			INSERT INTO acc.PreVoucherItem
			  (
				PreVoucherID,
				RowIndex,
				SlID,
				[Description],
				Description2,
				Debit,
				Credit,
				CurrencyID,
				CurrencyRate,
				CurrencyDebit,
				CurrencyCredit,
				IsAutoGenerated,
				Creator,
				CreationDate,
				LastEditor,
				LastEditionDate,
				Version
			  )
			SELECT 
				a.PrevoucherID,
				1,
				a.SlID,
				ISNULL(a.AllocationSharingDescription,' '),
				ISNULL(a.AllocationSharingDescription2,' '),
				case when a.AllocationSharingAmount < 0 then abs(a.AllocationSharingAmount) else 0 end,
				case when a.AllocationSharingAmount > 0 then abs(a.AllocationSharingAmount) else 0 end,
				-1,
				1,
				case when a.AllocationSharingAmount < 0 then abs(a.AllocationSharingAmount) else 0 end,
				case when a.AllocationSharingAmount > 0 then abs(a.AllocationSharingAmount) else 0 end,
				1,
				@CreatorId,
				GETDATE(),
				@CreatorId,
				GETDATE(),
				1
			FROM  #T a

		end

	    -----------------------------------AccountsPayable insert------------------
	    IF @PurchaseInvoicePrevoucherMode <> 0
	    BEGIN
			INSERT INTO acc.PreVoucherItem
				(
				PreVoucherID,
				RowIndex,
				SlID,
				[Description],
				Description2,
				Debit,
				Credit,
				CurrencyID,
				CurrencyRate,
				CurrencyDebit,
				CurrencyCredit,
				IsAutoGenerated,
				Creator,
				CreationDate,
				LastEditor,
				LastEditionDate,
				Version,
				BaseDocumentName,
				BaseDocumentID
				)
			select
				PreVoucherId,
				1,
				b.SlID,
				ISNULL(PayableAccountsVsStatementAndAdditionDescription,''),
				ISNULL(PayableAccountsVsStatementAndAdditionDescription2,''),
				0,
				NetInBaseCurrency -ISNULL(c.PriceInBaseCurrency, 0) -ISNULL(d.DeductionInBaseCurrency, 0)-AllocationSharingAmount,
				CurrencyId,
				currencyrate,
				0,
				Net -ISNULL(c.Price, 0) -ISNULL(d.Deduction, 0),
				1,
				@CreatorId,
				GETDATE(),
				@CreatorId,
				GETDATE(),
				0,
				'PurchaseInvoice',
				b.PurchaseInvoiceID
			from  
			(
			select  ConfirmPurchaseInvoiceID,SUM(Net) Net,
					SUM(NetInBaseCurrency) NetInBaseCurrency,
					sum(AllocationSharingAmount) AllocationSharingAmount
			from #TItem
			group by ConfirmPurchaseInvoiceID
			)a
			join #ConfirmPurchaseInvoice b on a.ConfirmPurchaseInvoiceID = b.ConfirmPurchaseInvoiceID	
			left join
			(
			select ConfirmPurchaseInvoiceID,SUM(Price) Price,SUM(PriceInBaseCurrency) PriceInBaseCurrency
			from #ConfirmStatementPrePayment
			group by ConfirmPurchaseInvoiceID
			)c on c.ConfirmPurchaseInvoiceID = b.ConfirmPurchaseInvoiceID
			left join
			(
			select ConfirmPurchaseInvoiceID,SUM(Deduction) Deduction,SUM(DeductionInBaseCurrency) DeductionInBaseCurrency
			from #Deduction
			group by ConfirmPurchaseInvoiceID
			)d on d.ConfirmPurchaseInvoiceID = b.ConfirmPurchaseInvoiceID
			where NetInBaseCurrency -ISNULL(c.PriceInBaseCurrency, 0) -ISNULL(d.DeductionInBaseCurrency, 0)-AllocationSharingAmount <> 0        

			-- ارزش افزوده فقط به ارز پایه ثبت می‌شود؛ به همین دلیل ردیف جداگانه (بدون ارز) دارد
			INSERT INTO acc.PreVoucherItem
				(
				PreVoucherID,
				RowIndex,
				SlID,
				[Description],
				Description2,
				Debit,
				Credit,
				CurrencyID,
				CurrencyRate,
				CurrencyDebit,
				CurrencyCredit,
				IsAutoGenerated,
				Creator,
				CreationDate,
				LastEditor,
				LastEditionDate,
				Version,
				BaseDocumentName,
				BaseDocumentID
				)
			select
				PreVoucherId,
				1,
				b.SlID,
				ISNULL(PayableAccountsVsVat,''),
				ISNULL(PayableAccountsVsVat2,''),
				0,
				a.VatInBaseCurrency,
				-1,
				1,
				0,
				a.VatInBaseCurrency,
				1,
				@CreatorId,
				GETDATE(),
				@CreatorId,
				GETDATE(),
				0,
				'PurchaseInvoice',
				b.PurchaseInvoiceID
			from
			(
			select ConfirmPurchaseInvoiceID, SUM(VatInBaseCurrency) VatInBaseCurrency
			from #TItem
			group by ConfirmPurchaseInvoiceID
			)a
			join #ConfirmPurchaseInvoice b on a.ConfirmPurchaseInvoiceID = b.ConfirmPurchaseInvoiceID
			where a.VatInBaseCurrency <> 0
		end

	    INSERT INTO Acc.PreVoucherItemAccountLevel
	        (
	        PreVoucherItemID,
	        AccountLevelID,
	        DlID,
	        [Value],
	        Creator,
	        CreationDate,
	        LastEditor,
	        LastEditionDate,
	        Version
	        )
	    SELECT  b.PreVoucherItemID,
	            c.AccountLevelID,
	            a.PartyDLID,
	            NULL,
	            @CreatorId,
	            GETDATE(),
	            @CreatorId,
	            GETDATE(),
	            0
	    FROM   #ConfirmPurchaseInvoice a
		JOIN acc.PreVoucherItem b on a.PrevoucherID = b.PreVoucherID
		JOIN acc.dl on dl.DLID = a.PartyDLID --party
	    JOIN acc.AccountLevelSL c ON  c.SLID = b.SlID AND c.DlTypeID = dl.DlTypeID
	        
	    INSERT INTO Acc.PreVoucherItemAccountLevel
	        (
	        PreVoucherItemID,
	        AccountLevelID,
	        DlID,
	        [Value],
	        Creator,
	        CreationDate,
	        LastEditor,
	        LastEditionDate,
	        Version
	        )
	    SELECT  b.PreVoucherItemID,
	            c.AccountLevelID,
	            ContractDlId,
	            NULL,
	            @CreatorId,
	            GETDATE(),
	            @CreatorId,
	            GETDATE(),
	            0
	    FROM   #ConfirmPurchaseInvoice a
		JOIN acc.PreVoucherItem b on a.PrevoucherID = b.PreVoucherID
		JOIN acc.dl on dl.DLID = a.ContractDlId
	    JOIN acc.AccountLevelSL c ON  c.SLID = b.SlID AND c.DlTypeID = dl.DlTypeID

		
		;with temp as 
		(
			select  a.PreVoucherItemID,
					ROW_NUMBER() over(partition by a.PreVoucherID order by a.PreVoucherItemID) RowIndex,
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(REPLACE(a.Description,
						'@@PartyTitle@@',b.PartyTitle),
						'@@DlTitle@@',b.PartyTitle),
						'@@PurchaseInvoiceNumber@@',ISNULL(b.InvoiceNumber,'')),
						'@@PurchaseInvocieSolarDate@@',isnull(b.InvoiceDate_PersianFullDateAlternateKey,N'')),
						'@@PurchaseInvocieADDate@@',isnull(b.InvoiceDate_FullDateAlternateKey,N'')),
						'@@Number@@',b.Number),
						'@@Date_Gregorian@@',FullDateAlternateKey),
						'@@Date_Solar@@',PersianFullDateAlternateKey),'@@PurchaseInvoiceADDate@@',cfg.GetCLRSaturnDate (b.PurchaseInvoiceDate,'yyyy/mm/dd',0,1))
						,'@@PurchaseInvoiceSolarDate@@',
						cfg.GetCLRSaturnDate(b.PurchaseInvoiceDate,'yyyy/mm/dd',0,0)) [Description],
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(REPLACE(a.Description2,
						'@@PartyTitle@@',b.PartyTitle2),
						'@@DlTitle@@',b.PartyTitle2),
						'@@PurchaseInvoiceNumber@@',ISNULL(b.InvoiceNumber,'')),
						'@@PurchaseInvocieSolarDate@@',isnull(b.InvoiceDate_PersianFullDateAlternateKey,N'')),
						'@@PurchaseInvocieADDate@@',isnull(b.InvoiceDate_FullDateAlternateKey,N'')),
						'@@Number@@',b.Number),
						'@@Date_Gregorian@@',FullDateAlternateKey),
						'@@Date_Solar@@',PersianFullDateAlternateKey),'@@PurchaseInvoiceADDate@@',cfg.GetCLRSaturnDate (b.PurchaseInvoiceDate,'yyyy/mm/dd',0,1))
						,'@@PurchaseInvoiceSolarDate@@',
						cfg.GetCLRSaturnDate(b.PurchaseInvoiceDate,'yyyy/mm/dd',0,0)) [Description2]
			from #ConfirmPurchaseInvoice b
			join  acc.PreVoucherItem a  on a.PrevoucherID = b.PreVoucherID
		)

		update v
		set RowIndex = vi.RowIndex,
			Description = vi.Description,
			Description2 = vi.Description2
		from acc.PreVoucherItem v
		join temp vi  on v.PreVoucherItemID = vi.PreVoucherItemID
		


		update a
		set [Description] =
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(REPLACE(a.Description,
						'@@PartyTitle@@',b.PartyTitle),
						'@@DlTitle@@',b.PartyTitle),
						'@@PurchaseInvoiceNumber@@',ISNULL(b.InvoiceNumber,'')),
						'@@PurchaseInvocieDate_Solar@@',isnull(b.InvoiceDate_PersianFullDateAlternateKey,N'')),
						'@@PurchaseInvocieDate_AD@@',isnull(b.InvoiceDate_FullDateAlternateKey,N'')),
						'@@Number@@',b.Number),
						'@@Date_Gregorian@@',FullDateAlternateKey),
						'@@Date_Solar@@',PersianFullDateAlternateKey),'@@PurchaseInvoiceADDate@@',cfg.GetCLRSaturnDate (b.PurchaseInvoiceDate,'yyyy/mm/dd',0,1))
						,'@@PurchaseInvoiceSolarDate@@',cfg.GetCLRSaturnDate(b.PurchaseInvoiceDate,'yyyy/mm/dd',0,0)) ,
			[Description2] =
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(REPLACE(a.Description2,
						'@@PartyTitle@@',b.PartyTitle2),
						'@@DlTitle@@',b.PartyTitle2),
						'@@PurchaseInvoiceNumber@@',ISNULL(b.InvoiceNumber,'')),
						'@@PurchaseInvocieDate_Solar@@',isnull(b.InvoiceDate_PersianFullDateAlternateKey,N'')),
						'@@PurchaseInvocieDate_AD@@',isnull(b.InvoiceDate_FullDateAlternateKey,N'')),
						'@@Number@@',b.Number),
						'@@Date_Gregorian@@',FullDateAlternateKey),
						'@@Date_Solar@@',PersianFullDateAlternateKey),
						'@@PurchaseInvoiceADDate@@',cfg.GetCLRSaturnDate (b.PurchaseInvoiceDate,'yyyy/mm/dd',0,1))
						,'@@PurchaseInvoiceSolarDate@@',
						cfg.GetCLRSaturnDate(b.PurchaseInvoiceDate,'yyyy/mm/dd',0,0)) 
		from acc.PreVoucher a
		join #ConfirmPurchaseInvoice b on a.PrevoucherID = b.PrevoucherID

