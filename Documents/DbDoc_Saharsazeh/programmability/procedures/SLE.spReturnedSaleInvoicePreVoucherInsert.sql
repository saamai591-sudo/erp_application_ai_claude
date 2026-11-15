------------------------------------- END #49017
------------------------------------- START #64912
CREATE   PROCEDURE [SLE].spReturnedSaleInvoicePreVoucherInsert
	@ReturnedSaleDescriptionInvoiceID NVARCHAR(MAX)
--WITH ENCRYPTION	
AS

	    DECLARE @DocumentNumTypeId     INT = (SELECT DocumentNumTypeID  FROM   CFG.DocumentNumType  WHERE EngName = 'ReturnedSaleInvoice'),
				@MDEntity INT = (select Top 1 Id from mdt.DmdEntity AS de where Name = 'ReturnedSaleInvoice'),
	            @IfDiscountVoucherable VARCHAR(10),
				@BaseDigit			   INT,
				@creatorId			   INT ,
				@Culture			   VARCHAR(10),
				@MaxPrevoucherID	   INT,
				@HeaderDescription  nvarchar(max),
				@HeaderDescription2 nvarchar(max),
				@ReturnedSaleDescription nvarchar(max),
				@ReturnedSaleDescription2 nvarchar(max),
				@TaxDescription nvarchar(max),
				@TaxDescription2 nvarchar(max),
				@DutyDescription nvarchar(max),
				@DutyDescription2 nvarchar(max),
				@DiscountDescription nvarchar(max),
				@DiscountDescription2 nvarchar(max),
				@ReceivableAccountsDescription nvarchar(max),
				@ReceivableAccountsDescription2 nvarchar(max)
	            

		SELECT [value] ID
		INTO #DocumentIds
		FROM   cfg.R_FnCommaStr2Table(@ReturnedSaleDescriptionInvoiceID) 

		set @creatorId = cfg.GetuserID();
		SET @Culture = CFG.GetuserCulture()
		set @BaseDigit = cfg.GetBaseCurrencyPrecision()

		select  @HeaderDescription = Description,
				@HeaderDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'Header'

		select  @ReturnedSaleDescription = Description,
				@ReturnedSaleDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'ReturnedSale'

		select  @TaxDescription = Description,
				@TaxDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'Tax'

		select  @DutyDescription = Description,
				@DutyDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'Duty'

		select  @DiscountDescription = Description,
				@DiscountDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'Discount'

		select  @ReceivableAccountsDescription = Description,
				@ReceivableAccountsDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'ReceivableAccounts'
	    
	    --- FetchValues ---
		select @MaxPrevoucherID = max(PreVoucherID)
		from acc.PreVoucher

	    SELECT 
				i.ReturnedSaleInvoiceID,
				isnull(@MaxPrevoucherID,0) + ROW_NUMBER() over(order by i.ReturnedSaleInvoiceID) PrevoucherID,
				p.DlID   ,
				case when c.IsBaseCurrencyBasis = 0 
					then ROUND(i.TotalTax*currencyrate/c.ExchangeUnit ,@BaseDigit) 
					when c.IsBaseCurrencyBasis = 1
					then ROUND(i.TotalTax*c.ExchangeUnit/currencyrate ,@BaseDigit) 
					end TotalTax,
				case when c.IsBaseCurrencyBasis = 0 
					then ROUND(i.TotalDuty*currencyrate/c.ExchangeUnit ,@BaseDigit) 
					when c.IsBaseCurrencyBasis = 1
					then ROUND(i.TotalDuty*c.ExchangeUnit/currencyrate ,@BaseDigit) 
					end TotalDuty,
				i.BranchID,
				i.FinancialPeriodID,
				i.CurrencyID,
				i.CurrencyRate,
				i.TotalNetPrice,
				i.Number,
				case when c.IsBaseCurrencyBasis = 0 
					then ROUND(i.TotalNetPrice*currencyrate/c.ExchangeUnit ,@BaseDigit) 
					when c.IsBaseCurrencyBasis = 1
					then ROUND(i.TotalNetPrice*c.ExchangeUnit/currencyrate ,@BaseDigit) 
					end TotalNetPriceInBaseCurrency,
				i.Date,
				st.slid ReceivableSlID,
				c.ExchangeUnit,
				c.IsBaseCurrencyBasis,
				cc.dlid CostCenterDlID,
				@HeaderDescription  Description,
				@HeaderDescription2  Description2,
				cast(null as varchar(max)) ErrorMessage,
				st.TaxSlID,
				st.DutySlID,
				DD.FullDateAlternateKey,
				DD.PersianFullDateAlternateKey,
				st.Title SaleType,
				st.Title2 SaleType2,
				sa.Title salearea,
				sa.Title2 salearea2,
				EconomicCode,
				ISNULL(P.IdentificationCode,p.NationalID) NationalCode,
				p.Title + ISNULL(' '+p.LastName,'') CustomerTitle,
				p.Title2 + ISNULL(' '+p.LastName2,'') CustomerTitle2,
				c.Title CurrencyTitle,
				c.Title2 CurrencyTitle2,
				@TaxDescription TaxDescription,
				@TaxDescription2 TaxDescription2,
				@DutyDescription DutyDescription,
				@DutyDescription2 DutyDescription2,
				@ReceivableAccountsDescription ReceivableAccountsDescription,
				@ReceivableAccountsDescription2 ReceivableAccountsDescription2
			into #ReturnedSaleInvoice
	    FROM   sle.ReturnedSaleInvoice i 
		JOIN #DocumentIds on #DocumentIds.ID = i.ReturnedSaleInvoiceID
		join sle.SaleType st on st.SaleTypeID = i.SaleTypeID
	    INNER JOIN cfg.party p ON  i.CustomerID = p.PartyID
		join cfg.Currency c on c.CurrencyID = i.CurrencyID
		left join sle.salearea sa on sa.SaleAreaID = i.SaleAreaID
		left join cfg.CostCenter cc on cc.CostCenterID = sa.CostCenterID
		JOIN cfg.DimDate DD on DD.Date = i.Date
	    
		update #ReturnedSaleInvoice 
		set ErrorMessage = N'SLE_spReturnInvoicePreVoucherInsert_2^'+cast(Number as varchar(10))+char(10)+char(13)
		where TotalNetPrice IS NULL OR TotalNetPrice = 0

		update #ReturnedSaleInvoice 
		set ErrorMessage =ISNULL(ErrorMessage,'')+ N'TaxSlNotSpecified'+char(10)+char(13)
		where TotalTax > 0 and TaxSlID is null

		update #ReturnedSaleInvoice 
		set ErrorMessage = ISNULL(ErrorMessage,'') +N'DutySlNotSpecified'+char(10)+char(13)
		where TotalDuty > 0 and DutySlID IS null

		if exists (select * from #ReturnedSaleInvoice where ErrorMessage is not null )
		BEGIN	
			select ReturnedSaleInvoiceID,ErrorMessage from #ReturnedSaleInvoice
			RETURN;
		END

	    SELECT TOP 1 @IfDiscountVoucherable = configvalue
	    FROM   CFG.Configuration
	    WHERE  ConfigKey = 'SaleVoucherWithDiscount'

	       ---------------------------------------Returned Sale-----------------------------------------------	
         SELECT h.PrevoucherID,
				ReturnedSaleInvoiceItemID,
				h.ReturnedSaleInvoiceID,
                sm.ReturnedSaleSlID AS Slid,
                s.HasCurrency,
                h.CurrencyID,
                h.CurrencyRate,
                REPLACE(@ReturnedSaleDescription,'@@ItemDescription@@',isnull(it.[Description],'')) AS [Description],
                REPLACE (@ReturnedSaleDescription2,'@@ItemDescription@@',isnull(it.Description2,'')) AS [Description2],
                CASE WHEN @ifdiscountvoucherable  = 'true' then it.Price else it.Price - it.Discount end ReturnSalePrice,
                case  when @ifdiscountvoucherable='true' and IsBaseCurrencyBasis = 0 
							then ROUND(It.price * CurrencyRate / ExchangeUnit,@BaseDigit)
						when @ifdiscountvoucherable='true' and IsBaseCurrencyBasis = 1
							then ROUND(It.price * ExchangeUnit / CurrencyRate ,@BaseDigit)
						when @ifdiscountvoucherable='false' and IsBaseCurrencyBasis = 0 
							then ROUND((It.price - It.Discount) * CurrencyRate / ExchangeUnit,@BaseDigit)
						when @ifdiscountvoucherable='false' and IsBaseCurrencyBasis = 1
							then ROUND((It.price - It.Discount) *ExchangeUnit / CurrencyRate,@BaseDigit)
						end SalePriceInBaseCurrency,
				sd.StuffAccountGroupID
           INTO #TInvoice
        FROM   sle.ReturnedSaleInvoiceItem It
		join #ReturnedSaleInvoice h on it.ReturnedSaleInvoiceID = h.ReturnedSaleInvoiceID
		join stf.StuffDetail sd on sd.StuffID = It.StuffID
        left JOIN stf.StuffSaleSl sm
                    ON  sd.StuffAccountGroupID = sm.StuffAccountGroupID and it.SaleModelID = sm.SaleModelID
        left join acc.SL AS s on sm.ReturnedSaleSlID = s.SlID            
        WHERE  It.fee > 0 
       

  
		update a 
		set ErrorMessage =ISNULL(ErrorMessage,'')+ 'ForSomeStuffsReturnedSaleSlidHasNotDefinedInStuffAccountGroup^'+cast(Number as varchar(10))+char(10)+char(13)
		from #ReturnedSaleInvoice a
		join #TInvoice b on a.ReturnedSaleInvoiceID = b.ReturnedSaleInvoiceID
		where b.Slid is null

		if exists (select * from #ReturnedSaleInvoice where ErrorMessage is not null )
		BEGIN	
			select ReturnedSaleInvoiceID,ErrorMessage from #ReturnedSaleInvoice
			RETURN;
		END
		
	    
	    -- Insert Into PreVoucher Tabel
	    set identity_insert [ACC].[PreVoucher] on
	    INSERT INTO [ACC].[PreVoucher]([PreVoucherID],[BranchID],[DocumentNumtypeID],[Date],[FinancialPeriodID],[Description],[Description2],[Creator],[CreationDate],[LastEditor],[LastEditionDate],[Version])
		SELECT [PreVoucherID],BranchId,@DocumentNumTypeId,date,FinancialPeriodID,Description,Description2,@CreatorId,GETDATE(),@CreatorId,GETDATE(),0
		from #ReturnedSaleInvoice
		set identity_insert [ACC].[PreVoucher] off

	    UPDATE a
	    SET    PreVoucherID = b.PreVoucherId
		from sle.ReturnedSaleInvoice a
		join #ReturnedSaleInvoice b on a.ReturnedSaleInvoiceID = b.ReturnedSaleInvoiceID

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
        SELECT 
		    PreVoucherID,
            1,
            SlID,
            DESCRIPTION,
            Description2,
            SalePriceInBaseCurrency,
            0,
            CASE WHEN hasCurrency = 1 then CurrencyID else -1 end,
            CASE WHEN hasCurrency = 1 then CurrencyRate else 1 end,
            CASE WHEN hasCurrency = 1 then ReturnSalePrice else SalePriceInBaseCurrency End,
            0,
            @CreatorId,
            GETDATE(),
            @CreatorId,
            GETDATE(),
            0,
			'ReturnedSaleInvoiceItem',
			ReturnedSaleInvoiceItemID
		 FROM #Tinvoice
      
	    -- Insert	Tax		
	    INSERT INTO ACC.PreVoucherItem 
			(PreVoucherID ,
			 RowIndex	   ,
			 SlID           ,
			 DESCRIPTION , 
			 Description2,
			 Debit,
			 Credit,							 
			 CurrencyID ,
			 CurrencyRate, 
			 CurrencyDebit, 
			 CurrencyCredit,
			 Creator,  
			 CreationDate,
			 LastEditor,
			 LastEditionDate,
			 Version,
			 BaseDocumentName,
			 BaseDocumentID)
	    SELECT							
			PreVoucherId,
			1,
			TaxSlID,
			TaxDescription,
			TaxDescription2, 
			TotalTax ,
			0 ,     
			-1,
			1,
			TotalTax,
			0,  
			@CreatorId,
			GETDATE(),   
			@CreatorId,       
			GETDATE(),        
			0,
			'ReturnedSaleInvoice',
			ReturnedSaleInvoiceID
		from #ReturnedSaleInvoice
		where TotalTax > 0
	            
	    -- Insert	Duty			
	    INSERT INTO ACC.PreVoucherItem 
			(PreVoucherID ,
			 RowIndex	   ,
			 SlID           ,
			 DESCRIPTION , 
			 Description2,
			 Debit,
			 Credit,							 
			 CurrencyID ,
			 CurrencyRate, 
			 CurrencyDebit, 
			 CurrencyCredit,
			 Creator,  
			 CreationDate,
			 LastEditor,
			 LastEditionDate,
			 Version,
			 BaseDocumentName,
			 BaseDocumentID)
	    SELECT							
			PreVoucherId,
			1,
			DutySlID,
			DutyDescription,
			DutyDescription2, 
			TotalDuty ,
			0 ,     
			-1,
			1,
			TotalDuty,
			0,  
			@CreatorId,
			GETDATE(),   
			@CreatorId,       
			GETDATE(),        
			0,
			'ReturnedSaleInvoice',
			ReturnedSaleInvoiceID
		from #ReturnedSaleInvoice
		where TotalDuty > 0
	            
	    -- Insert	Discount	
	    IF (@IfDiscountVoucherable = 'True')
	    BEGIN

	        SELECT h.ReturnedSaleInvoiceID,
				   h.PrevoucherID,
	               sm.DiscountSlID AS Slid,
	               s.HasCurrency,
	               REPLACE (@DiscountDescription,'@@ItemDescription@@',it.[Description]) Description,
				   REPLACE (@DiscountDescription2,'@@ItemDescription@@',it.Description2) Description2,
				   it.Discount,
				   h.CurrencyRate,
				   h.CurrencyID,
	               case  when  IsBaseCurrencyBasis = 0 
							then ROUND(It.Discount * CurrencyRate / ExchangeUnit,@BaseDigit)
						 when IsBaseCurrencyBasis = 1
							then ROUND(It.Discount * ExchangeUnit / CurrencyRate ,@BaseDigit)
						end DiscountInBaseCurrency,
					h.DlID,
					ReturnedSaleInvoiceItemID
	            INTO #TItem
	        FROM   sle.ReturnedSaleInvoiceItem It
			join #ReturnedSaleInvoice h on h.ReturnedSaleInvoiceID = It.ReturnedSaleInvoiceID
			join stf.StuffDetail sd on sd.StuffID = It.StuffID
	        left JOIN stf.StuffSaleSl sm ON  sd.StuffAccountGroupID = sm.StuffAccountGroupID and sm.SaleModelID = it.SaleModelID
	        left join acc.SL AS s on sm.DiscountSlID = s.SlID
	        WHERE  It.Discount > 0 
	        
			update a 
			set ErrorMessage = 'SLE_spInvoicePreVoucherInsert_12^'+cast(Number as varchar(10))+char(10)+char(13)
			from #ReturnedSaleInvoice a
			join #TItem b on a.ReturnedSaleInvoiceID = b.ReturnedSaleInvoiceID
			where b.Slid is null

			if exists (select * from #ReturnedSaleInvoice where ErrorMessage is not null )
			BEGIN	
				select ReturnedSaleInvoiceID,ErrorMessage from #ReturnedSaleInvoice
				RETURN;
			END
			
			  	        
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
	        SELECT 
	            PreVoucherID,
	            1,
	            SlID,
	            DESCRIPTION,
	            Description2,
	            0,
	            DiscountInBaseCurrency,
	            CASE WHEN HasCurrency = 1 then CurrencyID else -1 end,
	            CASE WHEN HasCurrency = 1 then CurrencyRate else CurrencyRate end,
	            0,
	           CASE WHEN HasCurrency = 1 then  Discount else DiscountInBaseCurrency End,
	            @CreatorId,
	            GETDATE(),
	            @CreatorId,
	            GETDATE(),
	            0,
				'ReturnedSaleInvoiceItem',
				ReturnedSaleInvoiceItemID
	        FROM   #TItem


	    END
	    
	    -- Insert AccountsReceivables
	    INSERT INTO ACC.PreVoucherItem 
			(PreVoucherID ,
			 RowIndex	   ,
			 SlID           ,
			 DESCRIPTION , 
			 Description2,
			 Debit,
			 Credit,
			 CurrencyID ,
			 CurrencyRate, 
			 CurrencyDebit, 
			 CurrencyCredit,
			 Creator,  
			 CreationDate,
			 LastEditor,
			 LastEditionDate,
			 Version,
			 BaseDocumentName,
			 BaseDocumentID)
	    SELECT							
			PreVoucherId,
			1,
			ReceivableSlID,
			ReceivableAccountsDescription,
			ReceivableAccountsDescription2, 
			0,
			TotalNetPriceInBaseCurrency,     
			CurrencyId,
			CurrencyRate,
			0,
			TotalNetPrice,            
			@CreatorId,
			GETDATE(),   
			@CreatorId,       
			GETDATE(),        
			0,
			'ReturnedSaleInvoice',
			ReturnedSaleInvoiceID
		from #ReturnedSaleInvoice
		where TotalNetPrice > 0
	     
		INSERT INTO Acc.PreVoucherItemAccountLevel
	          (
	            PreVoucherItemID,
	            AccountLevelID,
	            DLID,
	            [Value],
	            Creator,
	            CreationDate,
	            LastEditor,
	            LastEditionDate,
	            Version
	          )
	        SELECT a.prevoucheritemid,
	               b.AccountLevelID,
	               h.DlID,
	               NULL,
	               @CreatorId,
	               GETDATE(),
	               @CreatorId,
	               GETDATE(),
	               0
		 from #ReturnedSaleInvoice h
		 join acc.prevoucheritem a on h.PrevoucherID = a.PreVoucherID
		 join acc.accountlevelsl b on a.slid = b.slid 
		 join acc.dl c on c.DLID = h.DlID and c.DlTypeID = b.DlTypeID

		INSERT INTO Acc.PreVoucherItemAccountLevel
	          (
	            PreVoucherItemID,
	            AccountLevelID,
	            DLID,
	            [Value],
	            Creator,
	            CreationDate,
	            LastEditor,
	            LastEditionDate,
	            Version
	          )
	        SELECT a.prevoucheritemid,
	               b.AccountLevelID,
	               CostCenterDlID,
	               NULL,
	               @CreatorId,
	               GETDATE(),
	               @CreatorId,
	               GETDATE(),
	               0
		 from #ReturnedSaleInvoice h
		 join acc.prevoucheritem a on h.PrevoucherID = a.PreVoucherID
		 join acc.accountlevelsl b on a.slid = b.slid 
		 join acc.dl c on c.DLID = h.CostCenterDlID and c.DlTypeID = b.DlTypeID

		;with temp as 
		(
			select  [pi].PreVoucherItemID,
					ROW_NUMBER() over(partition by pi.PreVoucherID order by PreVoucherItemID) RowIndex,
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE([pi].Description,
						'@@CurrencyTitle@@',i.CurrencyTitle),
						'@@EconomicCode@@',isnull(EconomicCode,'')),
						'@@NationalCode@@',isnull(NationalCode,'')),
						'@@CustomerTitle@@',CustomerTitle),
						'@@SaleAreaTitle@@',SaleArea),
						'@@SaleTypeTitle@@',SaleType),
						'@@Date_Gregorian@@',FullDateAlternateKey),
						'@@Date_Solar@@',PersianFullDateAlternateKey),
						'@@Number@@',i.Number) [Description],
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE([pi].Description2,
						'@@CurrencyTitle@@',i.CurrencyTitle2),
						'@@EconomicCode@@',isnull(EconomicCode,'')),
						'@@NationalCode@@',isnull(NationalCode,'')),
						'@@CustomerTitle@@',CustomerTitle2),
						'@@SaleAreaTitle@@',SaleArea2),
						'@@SaleTypeTitle@@',SaleType2),
						'@@Date_Gregorian@@',FullDateAlternateKey),
						'@@Date_Solar@@',PersianFullDateAlternateKey),
						'@@Number@@',i.Number) [Description2]
			from #ReturnedSaleInvoice i
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
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE([pi].Description,
						'@@CurrencyTitle@@',i.CurrencyTitle),
						'@@EconomicCode@@',isnull(EconomicCode,'')),
						'@@NationalCode@@',isnull(NationalCode,'')),
						'@@CustomerTitle@@',CustomerTitle),
						'@@SaleAreaTitle@@',SaleArea),
						'@@SaleTypeTitle@@',SaleType),
						'@@Date_Gregorian@@',FullDateAlternateKey),
						'@@Date_Solar@@',PersianFullDateAlternateKey),
						'@@Number@@',i.Number)		
		,
			[Description2] =
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE([pi].Description2,
						'@@CurrencyTitle@@',i.CurrencyTitle2),
						'@@EconomicCode@@',isnull(EconomicCode,'')),
						'@@NationalCode@@',isnull(NationalCode,'')),
						'@@CustomerTitle@@',CustomerTitle2),
						'@@SaleAreaTitle@@',SaleArea2),
						'@@SaleTypeTitle@@',SaleType2),
						'@@Date_Gregorian@@',FullDateAlternateKey),
						'@@Date_Solar@@',PersianFullDateAlternateKey),
						'@@Number@@',i.Number)
		from acc.PreVoucher pi
		join #ReturnedSaleInvoice i on pi.PrevoucherID = i.PrevoucherID
