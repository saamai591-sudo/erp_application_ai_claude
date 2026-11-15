
----------------------------------------------------------------------
CREATE     PROCEDURE [VND].ConfirmPurchaseInvoicePrePaymentInsert
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
			@ExchangeManner TINYINT --1=GainOrLoss  2=Cost
		
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

	select  @PayableAccountsVsStatementAndAdditionDescription = Description,
			@PayableAccountsVsStatementAndAdditionDescription2 = Description2
	from CFG.[VoucherDescription] 
	where MDEntityID = @MDEntity and [Key] = 'PayableAccountsVsStatementAndAddition'


	select  @PayableAccountsVsDeductionDescription = Description,
			@PayableAccountsVsDeductionDescription2 = Description2
	from CFG.[VoucherDescription] 
	where MDEntityID = @MDEntity and [Key] = 'PayableAccountsVsDeduction'

	select  @PayableAccountsVsPrepaymentDescription = Description,
			@PayableAccountsVsPrepaymentDescription2 = Description2
	from CFG.[VoucherDescription] 
	where MDEntityID = @MDEntity and [Key] = 'PayableAccountsVsPrepayment'

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
		    c.DLID ContractDLID,
		    cs.Date,
			f.FinancialPeriodID,
	        t.SlID PayableAccountSlId,
			case
						when IsBaseCurrencyBasis = 0
							then ROUND(Tax * currencyrate / ExchangeUnit , @BaseDigit)
						when IsBaseCurrencyBasis = 1
							then ROUND(Tax * ExchangeUnit / currencyrate, @BaseDigit)
						end Tax,
	        case
						when IsBaseCurrencyBasis = 0
							then ROUND(Duty * currencyrate / ExchangeUnit , @BaseDigit)
						when IsBaseCurrencyBasis = 1
							then ROUND(Duty *ExchangeUnit / currencyrate, @BaseDigit)
						end Duty,
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
		   @AllocationSharingDescription2 AllocationSharingDescription2
		into #ConfirmPurchaseInvoice
	FROM   VND.ConfirmPurchaseInvoice cs 
	left join VND.PurchaseInvoice c on c.PurchaseInvoiceID = cs.PurchaseInvoiceID
	join VND.PurchaseType t
		on t.PurchaseTypeID = c.Type
	left JOIN
	(
		SELECT PurchaseInvoiceID , SUM(Tax) Tax,SUM(Duty) Duty
		from  VND.PurchaseInvoiceItem
		group by PurchaseInvoiceID
	) i
		on i.PurchaseInvoiceID = cs.PurchaseInvoiceID
	join acc.dl on dl.DLID = c.DlID
	join cfg.Currency  on Currency.CurrencyID = c.CurrencyID
	JOIN #DocumentIds ids on ids.ID = CS.ConfirmPurchaseInvoiceID
	JOIN cfg.DimDate DD on DD.Date = CS.Date
	join cfg.FinancialPeriod  f on cs.Date between f.StartDate and f.EndDate

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
				ConfirmPurchaseInvoiceID,
				It.Price  - It.Discount Amount
	    INTO   #TItem
	    FROM   vnd.purchaseInvoiceItem It
		INNER JOIN #ConfirmPurchaseInvoice h on h.PurchaseInvoiceID = It.PurchaseInvoiceID
	    INNER JOIN STF.[Stuff] s
	    	ON  it.StuffID = s.StuffID
	    INNER JOIN stf.StuffDetail sd
	    	ON  s.StuffID = sd.StuffID
	    LEFT JOIN stf.StuffAccountGroup sag
	    	ON  sd.StuffAccountGroupID = sag.StuffAccountGroupID
	    LEFT JOIN cnt.ContractSubject cs
	    	ON  cs.ContractSubjectID = it.ContractSubjectID
	    LEFT JOIN cnt.Contract 
	    	ON  Contract.ContractID = cs.ContractID
	    LEFT JOIN stf.StuffAccountGroupPurchaseType sagpt
	    	ON  sagpt.StuffAccountGroupID = sag.StuffAccountGroupID
	    	AND sagpt.PurchaseTypeID = h.PurchaseTypeID	
	
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
					@AdditionDescription, 
					'@@RowDescription@@',isnull(cs.Description,'')) Description,
			REPLACE(
					@AdditionDescription2, 
					'@@RowDescription@@',isnull(cs.Description2,'')) Description2
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
					@DeductionDescription, 
					'@@RowDescription@@',isnull(cs.Description,'')) Description,
			REPLACE(
					@DeductionDescription2, 
					'@@RowDescription@@',isnull(cs.Description2,'')) Description2
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
		select  a.ConfirmStatementPrePaymentID,
				m.SlID,
				a.Price,
					case
					when h.IsBaseCurrencyBasis = 0
						then ROUND(a.Price * 
						case when a.PaymentSubjectID is not null then ps.CurrencyRate
								when a.DebitCreditNoteItemID is not null then dcni.CurrencyRate
								when a.ReceiveSubjectID is not null then rs.CurrencyRate
						end
						/ h.ExchangeUnit , @BaseDigit)
					when h.IsBaseCurrencyBasis = 1
						then ROUND(a.Price * h.ExchangeUnit / 
						case when a.PaymentSubjectID is not null then ps.CurrencyRate
								when a.DebitCreditNoteItemID is not null then dcni.CurrencyRate							
								when a.ReceiveSubjectID is not null then rs.CurrencyRate
						end							, @BaseDigit)
					end PriceInBaseCurrency,
				case when a.PaymentSubjectID is not null then ps.CurrencyRate
						when a.DebitCreditNoteItemID is not null then dcni.CurrencyRate
						when a.ReceiveSubjectID is not null then rs.CurrencyRate
				end	 CurrencyRate,
				b.AllocationSharingAmount,
				m.ExchangeGainLossSlID,
				@PrepaymentDescription Description,
				@PrepaymentDescription Description2,
				h.PrevoucherID,
				h.ConfirmPurchaseInvoiceID,
				h.CurrencyID
		into #ConfirmStatementPrePayment
		from cnt.ConfirmStatementPrePayment a
		join VND.ConfirmPurchaseInvoiceItem b
			on a.ConfirmStatementItemID = b.ConfirmPurchaseInvoiceItemID
		join cnt.AdditionDeductionTypeMethod m
			on m.AdditionDeductionTypeMethodID = b.AdditionDeductionTypeMethodID
		left join fin.PaymentSubject ps
			on ps.PaymentSubjectID = a.PaymentSubjectID
		left join cfg.DebitCreditNoteItem dcni
			on dcni.DebitCreditNoteItemID = a.DebitCreditNoteItemID
		left join fin.ReceiveSubject rs 
			on a.ReceiveSubjectID = rs.ReceiveSubjectID
		join #ConfirmPurchaseInvoice h 
			on h.ConfirmPurchaseInvoiceID = b.ConfirmPurchaseInvoiceID
		SELECT ConfirmPurchaseInvoiceID,
			   SUM(price)                   Price,
			   SUM(PriceInBaseCurrency)   PriceInBaseCurrency,
			   SUM(PriceInBaseCurrency) - SUM(AllocationSharingAmount) PriceInBaseCurrencyWithConfirmStatementRate
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

    	---CompanyRoll = 1
		if exists (select 1 from #ConfirmPurchaseInvoice )
		begin
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
	            ISNULL(Description,' '),
	            ISNULL(Description2,' '),
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
			--select * from acc.PreVoucherItem a
			--join #ConfirmPurchaseInvoice b on a.PreVoucherID = b.PrevoucherID
			--return
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
				   ISNULL(Description,' '),
				   ISNULL(Description2,' '),
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
				   'ConfirmStatementPrePayment',
				   ConfirmStatementPrePaymentID
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
				case when a.AllocationSharingAmount > 0 then abs(a.AllocationSharingAmount) else 0 end,
				case when a.AllocationSharingAmount < 0 then abs(a.AllocationSharingAmount) else 0 end,
				-1,
				1,
				case when a.AllocationSharingAmount > 0 then abs(a.AllocationSharingAmount) else 0 end,
				case when a.AllocationSharingAmount < 0 then abs(a.AllocationSharingAmount) else 0 end,
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
					ROW_NUMBER() over(partition by a.ConfirmPurchaseInvoiceItemID order by b.ContractSubjectID) Rno,
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
				case when a.AllocationSharingAmount > 0 then abs(a.AllocationSharingAmount) else 0 end,
				case when a.AllocationSharingAmount < 0 then abs(a.AllocationSharingAmount) else 0 end,
				CurrencyId,
				0,
				case when a.AllocationSharingAmount > 0 then abs(a.AllocationSharingAmount) else 0 end,
				case when a.AllocationSharingAmount < 0 then abs(a.AllocationSharingAmount) else 0 end,
				1,
				@CreatorId,
				GETDATE(),
				@CreatorId,
				GETDATE(),
				1
			FROM  #T a

		end

		end

		
		;with temp as 
		(
			select  [pi].PreVoucherItemID,
					ROW_NUMBER() over(partition by pi.PreVoucherID order by pi.PreVoucherItemID) RowIndex,
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE([pi].Description,
						'@@PartyTitle@@',i.PartyTitle),
						'@@Number@@',i.Number),
						'@@Date_Gregorian@@',i.FullDateAlternateKey),
						'@@Date_Solar@@',i.PersianFullDateAlternateKey) [Description],
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE([pi].Description2,
						'@@PartyTitle@@',i.PartyTitle2),
						'@@Number@@',i.Number),
						'@@Date_Gregorian@@',i.FullDateAlternateKey),
						'@@Date_Solar@@',i.PersianFullDateAlternateKey)[Description2]
			from #ConfirmPurchaseInvoice i
			join  acc.PreVoucherItem [pi]  on [pi].PrevoucherID = i.PreVoucherID
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
					REPLACE(a.Description,
						'@@PartyTitle@@',b.PartyTitle),
						'@@Number@@',b.Number),
						'@@Date_Gregorian@@',b.FullDateAlternateKey),
						'@@Date_Solar@@',b.PersianFullDateAlternateKey) ,
			[Description2] =
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(a.Description2,
						'@@PartyTitle@@',b.PartyTitle2),
						'@@Number@@',b.Number),
						'@@Date_Gregorian@@',b.FullDateAlternateKey),
						'@@Date_Solar@@',b.PersianFullDateAlternateKey)
		from acc.PreVoucher a
		join #ConfirmPurchaseInvoice b on a.PrevoucherID = b.PrevoucherID;
