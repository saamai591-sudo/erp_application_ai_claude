CREATE    PROCEDURE [VND].[spReturnInvoicePreVoucherInsert]
	@returnPourchaseInvoiceId NVARCHAR(MAX)
	--WITH ENCRYPTION
AS
			DECLARE @DocumentNumTypeId  INT = (select top 1 DNT.DocumentNumTypeID  from CFG.DocumentNumType DNT  Where DNT.EngName='ReturnInvoice'),
				@MDEntity INT = (select Top (1) de.ID from mdt.DmdEntity AS de where de.[Name] = 'ReturnInvoice'),
				@HeaderDescription  nvarchar(max),
				@HeaderDescription2 nvarchar(max),
				@PayableAccountsDescription nvarchar(max),
				@PayableAccountsDescription2 nvarchar(max),
				@PurchaseControlDescription  nvarchar(max),
				@PurchaseControlDescription2  nvarchar(max),
				@TaxDescription nvarchar(max),
				@TaxDescription2 nvarchar(max),
				@DutyDescription nvarchar(max),
				@DutyDescription2 nvarchar(max),
				@CurrentDate		DATETIME,
				@BaseDigit			INT,
				@CultureNO			INT,
				@creatorId			INT ,
				@Culture			VARCHAR(10),
				@MaxPrevoucherID	INT
	    
		SELECT [value] ID
		INTO #DocumentIds
		FROM   cfg.R_FnCommaStr2Table(@returnPourchaseInvoiceId) 

	    SET @CurrentDate = GETDATE()
		set @creatorId = cfg.GetuserID();
		set @Culture = cfg.GetuserCulture()

	    SELECT @CultureNO = CultureNo
	    FROM   cfg.CultureInfo
	    WHERE  Culture = @Culture    
	    
	    SET @BaseDigit = cfg.GetBaseCurrencyPrecision()
	    
		select  @HeaderDescription = Description,
				@HeaderDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'Header'

		select  @PayableAccountsDescription = Description,
				@PayableAccountsDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'PayableAccounts'

		select  @PurchaseControlDescription = Description,
				@PurchaseControlDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'PurchaseControl'

		select  @TaxDescription = Description,
				@TaxDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'Tax'

		select  @DutyDescription = Description,
				@DutyDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'Duty'
--------------------------Get values---------------------------		

		select @MaxPrevoucherID = max(PreVoucherID)
		from acc.PreVoucher

		SELECT	 isnull(@MaxPrevoucherID,0) + ROW_NUMBER() over(order by vpi.ReturnInvoiceID) PrevoucherID,
				 vpi.ReturnInvoiceID,
				 case when c.IsBaseCurrencyBasis = 0
						then ROUND(vpi.TotalTax*vpi.CurrencyRate/c.ExchangeUnit , @BaseDigit)
					  when c.IsBaseCurrencyBasis = 1
						then ROUND(vpi.TotalTax*c.ExchangeUnit / vpi.CurrencyRate, @BaseDigit)
					end PurchaseInvoiceTax,
				 vpi.CurrencyID,
				 vpi.DlID,
				 vpi.CurrencyRate,
				 case   when c.IsBaseCurrencyBasis = 0
							then ROUND(vpi.TotalDuty*vpi.CurrencyRate/c.ExchangeUnit , @BaseDigit)
						when c.IsBaseCurrencyBasis = 1
							then ROUND(vpi.TotalDuty*c.ExchangeUnit / vpi.CurrencyRate, @BaseDigit)
						end PurchaseInvoiceDuty, 
				 vpi.TotalNetPrice,
				 case   when c.IsBaseCurrencyBasis = 0
							then ROUND(vpi.TotalNetPrice*vpi.CurrencyRate/c.ExchangeUnit , @BaseDigit)
						when c.IsBaseCurrencyBasis = 1
							then ROUND(vpi.TotalNetPrice*c.ExchangeUnit / vpi.CurrencyRate, @BaseDigit)
						end TotalNetPriceInBaseCurrency, 
				 cast(vpi.Number as nvarchar(max)) Number,			
				 branchid,
				 vpi.FinancialPeriodID,
				 vpi.Date,
				 pt.SlID,
				 c.ExchangeUnit,
				 IsBaseCurrencyBasis,
				 pt.TaxSlId,
				 pt.DutySlId,
				 case when @CultureNO = 1 then pt.Title else pt.Title2 end PurchaseType,
				 cast(null as varchar(max)) ErrorMessage,
				 @HeaderDescription HeaderDescription,
				 @HeaderDescription2 HeaderDescription2,
				 @PayableAccountsDescription PayableAccountsDescription,
				 @PayableAccountsDescription2 PayableAccountsDescription2,
				 @TaxDescription TaxDescription,
				 @TaxDescription2 TaxDescription2,
				 @DutyDescription DutyDescription,
				 @DutyDescription2 DutyDescription2			,
				 DD.FullDateAlternateKey,
				 DD.PersianFullDateAlternateKey,
				d.Title AS PartyTitle , 
				d.Title2 AS PartyTitle2,
				pt.PurchaseTypeID
			into #ReturnInvoice
		FROM   VND.ReturnInvoice  vpi
		JOIN ACC.DL AS d ON d.DLID = vpi.DlID
		JOIN cfg.DimDate DD on DD.Date = Vpi.Date
		join #DocumentIds ids on ids.ID = vpi.ReturnInvoiceID
		join vnd.PurchaseType pt on pt.PurchaseTypeID = vpi.Type
		join cfg.Currency c on c.CurrencyID = vpi.CurrencyID
	
		update #ReturnInvoice 
		set ErrorMessage = N'PreTaxSlNotSpecifiedInPurchaseType^'+PurchaseType+char(10)+char(13)
		where TaxSlId is null

		if exists (select 1 from #ReturnInvoice where ErrorMessage is not null )
		BEGIN	
			select ReturnInvoiceID,ErrorMessage from #ReturnInvoice
			RETURN;
	    END

		update #ReturnInvoice 
		set ErrorMessage = ErrorMessage + N'PreDutySlNotSpecifiedInPurchaseType^'+PurchaseType+char(10)+char(13)
		where DutySlId is null

		if exists (select 1 from #ReturnInvoice where ErrorMessage is not null )
		BEGIN	
			select ReturnInvoiceID,ErrorMessage from #ReturnInvoice
			RETURN;
	    END

	    SELECT 
			   It.ReturnInvoiceItemID,
	           case when s.type = 0 then sagpt.SlID else sd.SlID end AS Slid,
	           @PurchaseControlDescription AS [Description],
			   @PurchaseControlDescription2 AS Description2,
			   case 
					when IsBaseCurrencyBasis = 0
						then ROUND((It.Price - It.Discount )* CurrencyRate / ExchangeUnit ,@BaseDigit) 
					when IsBaseCurrencyBasis = 1
						then ROUND((It.Price - It.Discount )* ExchangeUnit / CurrencyRate  ,@BaseDigit) 
				end amount,
	           sd.StuffID ,
			   h.PrevoucherID,
			   h.ReturnInvoiceID,
			   fee,
			   s.Code StuffCode
	           INTO #TItem
	    FROM   vnd.ReturnInvoiceItem  It
		INNER JOIN #ReturnInvoice h on h.ReturnInvoiceID = It.ReturnInvoiceID
		INNER JOIN stf.vwstuff s on s.StuffID = it.StuffID
	    INNER JOIN stf.StuffDetail sd
	        ON  It.StuffID = sd.StuffID
	    LEFT JOIN stf.StuffAccountGroup sag
	        ON  sd.StuffAccountGroupID = sag.StuffAccountGroupID
	    LEFT JOIN stf.StuffAccountGroupPurchaseType sagpt
	    	ON  sagpt.StuffAccountGroupID = sag.StuffAccountGroupID
	    	AND sagpt.PurchaseTypeID = h.PurchaseTypeID
		
		update a 
		set ErrorMessage = ErrorMessage + N'VND_spReturnPurchaseInvoicePreVoucherInsert_2^'+Number+char(10)+char(13)
		from #ReturnInvoice a
		join #TItem b on a.ReturnInvoiceID = b.ReturnInvoiceID
		where fee = 0

		if exists (select * from #ReturnInvoice where ErrorMessage is not null )
		BEGIN	
			select ReturnInvoiceID,ErrorMessage from #ReturnInvoice
			RETURN;
	    END

		update a 
		set ErrorMessage = ErrorMessage + N'PurchaseControlSlNotSpecified^'+StuffCode+char(10)+char(13)
		from #ReturnInvoice a
		join #TItem b on a.ReturnInvoiceID = b.ReturnInvoiceID
		where b.Slid is null

		if exists (select * from #ReturnInvoice where ErrorMessage is not null )
		BEGIN	
			select ReturnInvoiceID,ErrorMessage from #ReturnInvoice
			RETURN;
	    END
	    -----------------------------------insert in prevoucher------------------
		set identity_insert [ACC].[PreVoucher] on
	    INSERT INTO [ACC].[PreVoucher]([PreVoucherID],[BranchID],[DocumentNumtypeID],[Date],[FinancialPeriodID],[Description],[Description2],[Creator],[CreationDate],[LastEditor],[LastEditionDate],[Version])
		SELECT [PreVoucherID],BranchId,@DocumentNumTypeId,date,FinancialPeriodID,HeaderDescription,HeaderDescription2,@CreatorId,@CurrentDate,@CreatorId,@CurrentDate,0
		from #ReturnInvoice
		set identity_insert [ACC].[PreVoucher] off
    
	    UPDATE a
	    SET    PreVoucherID = b.PreVoucherId
		from VND.ReturnInvoice a
		join #ReturnInvoice b on a.ReturnInvoiceID = b.ReturnInvoiceID
	   
	    -----------------------------------AccountsPayable insert------------------
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
	        SlID,
	        PayableAccountsDescription,
	        PayableAccountsDescription2,
	        TotalNetPriceInBaseCurrency ,
	        0,	            
	        CurrencyId,
	        currencyrate,
	        TotalNetPrice ,
	        0,	            
	        1,
	        @CreatorId,
	        GETDATE(),
	        @CreatorId,
	        GETDATE(),
	        0,
			'ReturnInvoice',
			ReturnInvoiceID
	        from #ReturnInvoice
			where TotalNetPriceInBaseCurrency > 0 
	    -----------------------------------PurchaseControl insert------------------
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
		SELECT 
			PreVoucherID,
			1,
			SlID,
			[Description],
			Description2,
			0,
			amount,
			-1,
			1,
			0,
			amount,
			1,
			@creatorId,
			@CurrentDate,
			@creatorId,
			@CurrentDate,
			0,
			'ReturnInvoiceItem',
			ReturnInvoiceItemID
		FROM   #TItem	    
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
	    SELECT  PreVoucherId,
	            1,
	            TaxSlId,
	            TaxDescription,
	            TaxDescription2,
	            0,
	            PurchaseInvoiceTax,	               
	            -1,
	            1,
	            0,
	            PurchaseInvoiceTax,	               
	            @CreatorId,
	            GETDATE(),
	            @CreatorId,
	            GETDATE(),
	            0,
				'ReturnInvoice',
				ReturnInvoiceID
		from #ReturnInvoice 
		where PurchaseInvoiceTax > 0
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
	    SELECT PreVoucherId,
	            1,
	            DutySlId,
	            DutyDescription,
	            DutyDescription2,
	            0,
	            PurchaseInvoiceDuty,	               
	            -1,
	            1,
	            0,
	            PurchaseInvoiceDuty,	               
	            @CreatorId,
	            GETDATE(),
	            @CreatorId,
	            @CreatorId,
	            0,
				'ReturnInvoice',
				ReturnInvoiceID
	from #ReturnInvoice where PurchaseInvoiceDuty > 0

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
	            a.DLID,
	            NULL,
	            @CreatorId,
	            GETDATE(),
	            @CreatorId,
	            GETDATE(),
	            0
	    FROM   #ReturnInvoice a
		JOIN acc.PreVoucherItem b on a.PrevoucherID = b.PreVoucherID
		JOIN acc.dl on dl.DLID = a.DlID
	    JOIN acc.AccountLevelSL c ON  c.SLID = b.SlID AND c.DlTypeID = dl.DlTypeID
	        

		;with temp as 
		(
			select  [pi].PreVoucherItemID,
					ROW_NUMBER() over(partition by pi.PreVoucherID order by PreVoucherItemID) RowIndex,
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE([pi].Description, 
						'@@Number@@',i.Number),
						'@@Date_Gregorian@@',FullDateAlternateKey),
						'@@Date_Solar@@',PersianFullDateAlternateKey),
						'@@PartyTitle@@',i.PartyTitle
					) AS [Description],
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE([pi].Description2,
						'@@Number@@',i.Number),
						'@@Date_Gregorian@@',FullDateAlternateKey),
						'@@Date_Solar@@',PersianFullDateAlternateKey),
						'@@PartyTitle@@',i.PartyTitle2
					) AS [Description2]
			from #ReturnInvoice i

			join  acc.PreVoucherItem [pi]  on [pi].PrevoucherID = i.PreVoucherID
		)

		update v
		set RowIndex = vi.RowIndex,
			Description = vi.Description,
			Description2 = vi.Description2
		from acc.PreVoucherItem v
		join temp vi  on v.PreVoucherItemID = vi.PreVoucherItemID


				update pi
		set [Description] =
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE([pi].Description,
						'@@Number@@',i.Number),
						'@@Date_Gregorian@@',FullDateAlternateKey),
						'@@Date_Solar@@',PersianFullDateAlternateKey),
						'@@PartyTitle@@',i.PartyTitle
					)	
		,
			[Description2] =
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE([pi].Description2,
						'@@Number@@',i.Number),
						'@@Date_Gregorian@@',FullDateAlternateKey),
						'@@Date_Solar@@',PersianFullDateAlternateKey),
						'@@PartyTitle@@',i.PartyTitle2
					)
		from acc.PreVoucher pi
		join #ReturnInvoice i on pi.PrevoucherID = i.PrevoucherID

