------------------------------------- START #49017
CREATE   PROCEDURE [SLE].spInvoicePreVoucherInsert
	@InvoiceId NVARCHAR(MAX)	

--WITH ENCRYPTION 
	 AS 
	 set NOCOUNT on
	
	    DECLARE @DocumentNumTypeId		INT = (SELECT Top 1  DocumentNumTypeID  FROM   CFG.DocumentNumType  WHERE EngName = 'Invoice'),
				@MDEntity INT = (select Top 1 Id from mdt.DmdEntity AS de where Name = 'Invoice'),
	            @IfDiscountVoucherable	VARCHAR(10),
				@BaseDigit				int,
				@MaxPrevoucherID		int,
				@CreatorId				int,
				@HeaderDescription  nvarchar(max),
				@HeaderDescription2 nvarchar(max),
				@PreReceiveDescription			nvarchar(max),
				@PreReceiveDescription2			nvarchar(max),
				@SaleDescription nvarchar(max),
				@SaleDescription2 nvarchar(max),
				@ReceivableAccountsDescription nvarchar(max),
				@ReceivableAccountsDescription2 nvarchar(max),
				@DiscountDescription nvarchar(max),
				@DiscountDescription2 nvarchar(max),
				@CommissionExpenseDescription nvarchar(max),
				@CommissionExpenseDescription2 nvarchar(max),
				@PayableCommissionDescription nvarchar(max),
				@PayableCommissionDescription2 nvarchar(max),
				@TaxDescription nvarchar(max),
				@TaxDescription2 nvarchar(max),
				@DutyDescription nvarchar(max),
				@DutyDescription2 nvarchar(max),
				@ExchangeProfitLossDescription nvarchar(max),
				@ExchangeProfitLossDescription2 nvarchar(max),
				@Culture varchar(10),
				@CultureNo int


		SET @CreatorId = CFG.GetuserID();
		SET @Culture = cfg.GetuserCulture();

		select @CultureNo = CultureNo
		from cfg.CultureInfo
		where Culture = @Culture

		SELECT [value] ID
		INTO #DocumentIds
		FROM   cfg.R_FnCommaStr2Table(@InvoiceId) 				

		set @BaseDigit = cfg.GetBaseCurrencyPrecision()


		select  @HeaderDescription = Description,
				@HeaderDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'Header'

		select  @PreReceiveDescription = Description,
				@PreReceiveDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'CustomerAdavace'

		select  @SaleDescription = Description,
				@SaleDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'Sale'

		select  @ReceivableAccountsDescription = Description,
				@ReceivableAccountsDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'ReceivableAccounts'

		select  @DiscountDescription = Description,
				@DiscountDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'Discount'

		select  @CommissionExpenseDescription = Description,
				@CommissionExpenseDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'CommissionExpense'

		select  @PayableCommissionDescription = Description,
				@PayableCommissionDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'PayableCommission'

		select  @TaxDescription = Description,
				@TaxDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'Tax'

		select  @DutyDescription = Description,
				@DutyDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'Duty'

		select  @ExchangeProfitLossDescription = Description,
				@ExchangeProfitLossDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'ExchangeProfitLoss'
		
		 SELECT TOP 1 @IfDiscountVoucherable = LOWER(configvalue)
 FROM   CFG.Configuration
 WHERE  ConfigKey = 'SaleVoucherWithDiscount'

	
	    --- FetchValues ---
	    
	    
	    	    SELECT b.ID                             InvoiceID,
	    	           It.InvoiceItemID,
	    	           sm.SaleSlID       AS Slid,
	    	           REPLACE(
	    	               REPLACE(@SaleDescription, '@@StuffTitle@@', vw.Title),
	    	               '@@ItemDescription@@',
	    	               ISNULL(it.Description, '')
	    	           ) [Description],
	    	           REPLACE(
	    	               REPLACE(@SaleDescription2, '@@StuffTitle@@', vw.Title2),
	    	               '@@ItemDescription@@',
	    	               ISNULL(it.Description2, '')
	    	           ) [Description2],
	    	           it.BaseCurrencyPrice,
	    	           it.BaseCurrencyNetPrice,
	    	           It.AllocationSharingAmount,
	    	           saG.ExchangeSlId,
	    	           sd.StuffAccountGroupID,
	    	           @ExchangeProfitLossDescription ExchangeProfitLossDescription,
	    	           @ExchangeProfitLossDescription2 ExchangeProfitLossDescription2,
	    	           it.Tax,
	    	           it.BaseCurrencyTax,
	    	           it.Duty,
	    	           it.BaseCurrencyDuty,
	    	           it.Discount,
	    	           it.BaseCurrencyDiscount,
	    	           it.Price,
	    	           it.NetPrice,
	    	           CASE 
	    	                WHEN @ifdiscountvoucherable = 'true' THEN it.BaseCurrencyPrice
	    	                WHEN @ifdiscountvoucherable = 'false' THEN it.BaseCurrencyPrice - ISNULL(it.BaseCurrencyDiscount, 0)
	    	           END                  SalePriceInBaseCurrencyToBeVoucherd,
	    	           CASE 
	    	                WHEN @ifdiscountvoucherable = 'true' THEN It.price
	    	                WHEN @ifdiscountvoucherable = 'false' THEN It.BaseCurrencyPrice - ISNULL(It.BaseCurrencyDiscount, 0)
	    	           END                  SalePriceToBeVouchered
	    	    INTO   #TInvoice
	    	    FROM   Sle.InvoiceItem It
	    	           JOIN #DocumentIds b
	    	                ON  b.ID = It.InvoiceID
	    	           JOIN stf.StuffDetail sd
	    	                ON  sd.StuffID = It.StuffID
	    	           JOIN stf.VWStuff vw
	    	                ON  vw.stuffid = it.StuffID
	    	           left JOIN stf.StuffAccountGroup sag
	    	                ON  sag.StuffAccountGroupID = sd.StuffAccountGroupID
	    	           left JOIN stf.StuffSaleSl sm
	    	                ON  sd.StuffAccountGroupID = sm.StuffAccountGroupID
	    	                AND sm.SaleModelID = it.SaleModelID
	   
	    
		select @MaxPrevoucherID = MAX(PreVoucherID)
		from acc.PreVoucher

	    SELECT  isnull(@MaxPrevoucherID,0) + ROW_NUMBER() over(order by i.invoiceid) PrevoucherID,
				i.InvoiceID,
				p.DlID  CustomerDlID ,
				i.SaleInvoiceStatus,
				i.Number,
				i.BranchID,
				i.FinancialPeriodID,
				i.CurrencyID,
				i.CurrencyRate,
				i.TotalNetPrice,
				case when c.IsBaseCurrencyBasis = 0 
					then ROUND(i.Percentage*currencyrate/c.ExchangeUnit ,@BaseDigit) 
					when c.IsBaseCurrencyBasis = 1
					then ROUND(i.Percentage*c.ExchangeUnit/currencyrate ,@BaseDigit) 
					end PercentageInBaseCurrency,
				i.Percentage,
				I.Date,
				c.ExchangeUnit,
				it.slid ReceivableSlID,
				s.HasCurrency ReceivableSlIDHasCurrency,
				c.IsBaseCurrencyBasis,
				cc.dlid CostCenterDlID,
				cast(null as varchar(max)) ErrorMessage,
				SaleAgentID,
				EconomicCode,
				ISNULL(P.IdentificationCode,p.NationalID) NationalCode,
				p.Title + ISNULL(' '+p.LastName,'') CustomerTitle,
				p.Title2 + ISNULL(' '+p.LastName2,'') CustomerTitle2,
				sa.Title SaleArea,
				sa.Title2 SaleArea2,
				it.Title SaleType,
				it.Title2 SaleType2,
				DD.FullDateAlternateKey,
				DD.PersianFullDateAlternateKey,
				c.Title CurrencyTitle,
				c.Title2 CurrencyTitle2,
				@HeaderDescription HeaderDescription,
				@HeaderDescription2 HeaderDescription2,
				@ReceivableAccountsDescription ReceivableAccountsDescription,
				@ReceivableAccountsDescription2 ReceivableAccountsDescription2,
				@CommissionExpenseDescription CommissionExpenseDescription,
				@CommissionExpenseDescription2 CommissionExpenseDescription2,
				@PayableCommissionDescription PayableCommissionDescription,
				@PayableCommissionDescription2 PayableCommissionDescription2,
				@TaxDescription TaxDescription,
				@TaxDescription2 TaxDescription2,
				@DutyDescription DutyDescription,
				@DutyDescription2 DutyDescription2,
				i.TotalTax,i.TotalDuty,
				it.TaxSlID,
				it.DutySlID,
				i.ParentInvoiceID
			into #Invoices
	    FROM   sle.Invoice i 
		JOIN #DocumentIds b on i.InvoiceID = b.ID
		JOIN sle.SaleType it on it.SaleTypeID = i.SaleTypeID
		join acc.SL AS s on it.SlID = s.SlID
	    JOIN cfg.party p  ON  i.CustomerID = p.PartyID
		JOIN cfg.Currency c on c.CurrencyID = i.CurrencyID
		LEFT JOIN sle.salearea sa on sa.SaleAreaID = i.SaleAreaID
		LEFT JOIN cfg.CostCenter cc on cc.CostCenterID = sa.CostCenterID
		JOIN cfg.DimDate DD on DD.Date = i.Date
		where i.PreVoucherID is null
		
			    
		 
		SELECT  a.InvoicePreReceiveID,
				b.InvoiceID,
				b.PrevoucherID,
				a.Price,
				case when a.ReceiveSubjectID is not null 
						then rt.SLID
					when a.DebitCreditNoteItemID is not null 
						then rt2.SLID 
					end SLID,
				case when a.ReceiveSubjectID is not null and c.IsBaseCurrencyBasis = 0
						then 
							ROUND(Price*rs.CurrencyRate/c.ExchangeUnit,@BaseDigit)
				    when a.ReceiveSubjectID is not null and c.IsBaseCurrencyBasis = 1
						then
							ROUND(Price*c.ExchangeUnit/rs.CurrencyRate,@BaseDigit)
					when a.DebitCreditNoteItemID is not null and c2.IsBaseCurrencyBasis = 0
						then 
							ROUND(Price*dcni.CurrencyRate/c2.ExchangeUnit,@BaseDigit)
					when a.DebitCreditNoteItemID is not null and c2.IsBaseCurrencyBasis = 1
						then 
							ROUND(Price*c2.ExchangeUnit/dcni.CurrencyRate,@BaseDigit)
						end PriceInBaseCurrency,
				case when a.ReceiveSubjectID is not null then rs.CurrencyID
					 when a.DebitCreditNoteItemID is not null then dcni.CurrencyID end CurrencyID,
				case when a.ReceiveSubjectID is not null then rs.CurrencyRate
					 when a.DebitCreditNoteItemID is not null then dcni.CurrencyRate end CurrencyRate,
				@PreReceiveDescription [Description],
				@PreReceiveDescription2 [Description2]
		into #InvoicePreReceive
		FROM SLE.InvoicePreReceive a
		join #Invoices b on a.InvoiceID = b.InvoiceID
		left join fin.ReceiveSubject rs on a.ReceiveSubjectID = rs.ReceiveSubjectID
		left join fin.ReceiptType rt on rt.ReceiptTypeID = rs.ReceiptTypeID
		left join cfg.Currency c on c.CurrencyID = rs.CurrencyID
		left join cfg.DebitCreditNoteItem dcni on dcni.DebitCreditNoteItemID = a.DebitCreditNoteItemID
		left join fin.ReceiptType rt2 on rt2.ReceiptTypeID = dcni.ReceiptTypeID
		left join cfg.Currency c2 on c2.CurrencyID = dcni.CurrencyID

	    SELECT TOP 1 @IfDiscountVoucherable = LOWER(configvalue)
	    FROM   CFG.Configuration
	    WHERE  ConfigKey = 'SaleVoucherWithDiscount'




		update b 
		set ErrorMessage = N'SLE_spInvoicePreVoucherInsert_11^'+cast(Number as varchar(50))+char(10)+char(13)
		from #TInvoice a
		join #Invoices b on a.InvoiceID = b.InvoiceID
		where a.Slid is null 

		update b 
		set ErrorMessage =isnull(ErrorMessage,'') + N'برای برخی از کالاها، گروه حساب انتخاب نشده است'+char(10)+char(13)
		from #TInvoice a
		join #Invoices b on a.InvoiceID = b.InvoiceID
		where StuffAccountGroupID is null 


		update #Invoices
		set ErrorMessage = isnull(ErrorMessage,'') + N'SLE_spInvoicePreVoucherInsert_4^'+cast(Number as varchar(50))+char(10)+char(13)
		from #Invoices 
		where TotalNetPrice = 0 

		 IF (SELECT LOWER(ConfigValue)
		  FROM CFG.Configuration s
		    WHERE s.ConfigKey = 'InvoiceNeedConfirm')= 'true'
				 BEGIN					
				 
					update #Invoices
					set ErrorMessage = isnull(ErrorMessage,'') + N'SLE_spInvoicePreVoucherInsert_5^'+cast(Number as varchar(50))+char(10)+char(13)
					from #Invoices 
					where SaleInvoiceStatus =1

				 END
			 

	        
		update #Invoices
		set ErrorMessage = isnull(ErrorMessage,'') + N'TaxSlNotSpecifiedInSaleType^'+case when @CultureNo = 1 then SaleType else SaleType2 end+char(10)+char(13)
		from #Invoices 
		WHERE TotalTax > 0 and TaxSlID is null
	 
		
		update #Invoices
		set ErrorMessage = isnull(ErrorMessage,'') + N'DutySlNotSpecifiedInSaleType^'+case when @CultureNo = 1 then SaleType else SaleType2 end+char(10)+char(13)
		from #Invoices 
		where TotalDuty > 0 and DutySlID is null

		if exists (select * from #Invoices where ErrorMessage is not null )
		BEGIN	
			select InvoiceID,ErrorMessage from #Invoices
			RETURN;
	    END

		IF EXISTS (SELECT 1 FROM #InvoicePreReceive WHERE SLID IS NULL)
		BEGIN	
			RAISERROR('FinanceManager.Messages.SlIsNullInPreReceive',16,10)
		END	

		SELECT  It.InvoiceItemID,
				It.InvoiceID,
	            sss.DiscountSlID AS Slid,
				case when IsBaseCurrencyBasis = 0
					then 
						ROUND(Discount*CurrencyRate/ExchangeUnit,@BaseDigit)
				when IsBaseCurrencyBasis = 1
					then
						ROUND(Discount*ExchangeUnit/CurrencyRate,@BaseDigit)
						end  DiscountInBaseCurrency,
				Discount,
				@DiscountDescription [Description],
				@DiscountDescription2 [Description2],
				ROW_NUMBER() over(order by InvoiceItemID) PrevoucherItemID,
				PrevoucherID,
				CustomerDlID DlID
	     INTO #TItem
	    FROM   Sle.InvoiceItem It
		join #Invoices b on b.InvoiceID = It.InvoiceID
		join stf.StuffDetail sd	on It.StuffID = sd.StuffID
		left join stf.StuffSaleSl sss on sss.StuffAccountGroupID = sd.StuffAccountGroupID
										and sss.SaleModelID = it.SaleModelID
	    WHERE It.Discount > 0 


		update a
		set ErrorMessage = isnull(ErrorMessage,'') + 'در برخی از گروه حسابها معین سود وزیان تسعیر ارز وارد نشده است.'+char(10)+char(13)
		from #Invoices a
		join #TInvoice b on a.InvoiceID = b.InvoiceID
		where AllocationSharingAmount <> 0 and ExchangeSlID is null

		update a
		set ErrorMessage = isnull(ErrorMessage,'') + N'SLE_spInvoicePreVoucherInsert_12^'+cast(Number as varchar(50))+char(10)+char(13)
		from #Invoices  a
		join #TItem b on a.InvoiceID = b.InvoiceID
		where b.Slid IS null and  (@IfDiscountVoucherable = 'true')

	    DECLARE @PercentageCost INT
	    SELECT @PercentageCost = ConfigValue 
		FROM CFG.Configuration s
	    WHERE s.ConfigKey = 'PourcentageCost'
	    	
		update a
		set ErrorMessage = isnull(ErrorMessage,'') + N'SLE_spInvoicePreVoucherInsert_13'+char(10)+char(13)
		from #Invoices a
		where a.Percentage > 0 and @PercentageCost IS null 

	    DECLARE @PercentagePayable INT
	    SELECT @PercentagePayable = ConfigValue 
		FROM CFG.Configuration s
	    WHERE s.ConfigKey = 'PourcentagePayable'
	    	
		update a
		set ErrorMessage = isnull(ErrorMessage,'') + N'SLE_spInvoicePreVoucherInsert_14'+char(10)+char(13)
		from #Invoices a
		where a.Percentage > 0 and @PercentagePayable IS null 

		if exists (select * from #Invoices where ErrorMessage is not null )
		BEGIN	
			select InvoiceID,ErrorMessage from #Invoices
			RETURN;
		END			

		IF EXISTS (SELECT * FROM #InvoicePreReceive WHERE SLID IS NULL)
		BEGIN	
			RAISERROR('FinanceManager.Messages.SlIsNullInPreReceive',16,10)
		END		
		

		
	    -- Insert Into PreVoucher Tabel
		set identity_insert [ACC].[PreVoucher] on
	    INSERT INTO [ACC].[PreVoucher]([PreVoucherID],[BranchID],[DocumentNumtypeID],[Date],[FinancialPeriodID],[Description],[Description2],[Creator],[CreationDate],[LastEditor],[LastEditionDate],[Version])
		SELECT [PreVoucherID],BranchId,@DocumentNumTypeId,date,FinancialPeriodID,HeaderDescription,HeaderDescription2,@CreatorId,GETDATE(),@CreatorId,GETDATE(),0
		from #Invoices
		set identity_insert [ACC].[PreVoucher] off
	    UPDATE a
	    SET    PreVoucherID = b.PreVoucherId
		from sle.Invoice a
		join #Invoices b on a.InvoiceID = b.InvoiceID


		
		------------Using Invoice Totals
		select InvoiceID,sum(BaseCurrencyPrice)	 TotalSalePriceInBaseCurrency,sum(Price) TotalSalePrice,SUM(Tax) TotalTax,SUM(BaseCurrencyTax) TotalBaseCurrencyTax,
			SUM(Duty) TotalDuty,SUM(BaseCurrencyDuty) TotalBaseCurrencyDuty,SUM(Discount) TotalDiscount,SUM(BaseCurrencyDiscount) TotalBaseCurrencyDiscount,
			SUM(NetPrice) TotalNetPrice,SUM(BaseCurrencyNetPrice) TotalBaseCurrencyNetPrice
			into #InvoiceTotals
			from #TInvoice
			group by InvoiceID
			
				    -------------------- Insert AccountsReceivable	------------------------

	    INSERT INTO ACC.PreVoucherItem (PreVoucherID ,RowIndex,SlID,DESCRIPTION , Description2,Debit,Credit,CurrencyID ,CurrencyRate, CurrencyDebit, CurrencyCredit,Creator,  CreationDate,LastEditor,LastEditionDate,Version,BaseDocumentName,BaseDocumentID)
	     SELECT	PreVoucherId,
				1,
				ReceivableSlID,
				ReceivableAccountsDescription,
				ReceivableAccountsDescription2,
				b.TotalBaseCurrencyNetPrice - ISNULL(d.PrereceivePriceInBaseCurrency,0),
				0,				
				CASE WHEN s.HasCurrency = 1 then a.CurrencyID else -1 end,						
				CASE WHEN s.HasCurrency = 1 then a.CurrencyRate else 1 end,
				CASE WHEN s.HasCurrency = 1 then b.TotalNetPrice - ISNULL(d.PrereceivePrice,0) 
				else b.TotalBaseCurrencyNetPrice - ISNULL(d.PrereceivePriceInBaseCurrency,0) end ,
				0,	
				@CreatorId,
				GETDATE(),
				@CreatorId,
				GETDATE(),
				0,
				'Invoice',
				a.InvoiceID
		from #Invoices a
		join acc.SL AS s on a.ReceivableSlID = s.SlID
		left join 
			#InvoiceTotals b on a.InvoiceID = b.InvoiceID		
		left join 
			(
			select InvoiceID,sum(Price)	 PrereceivePrice,SUM(PriceInBaseCurrency) PreReceivePriceInBaseCurrency
			from #InvoicePreReceive
			group by InvoiceID
			)d on a.InvoiceID = d.InvoiceID
		 
	    
	 	------------------------------- Insert	PreReceive		--------------------------
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
	        a.PreVoucherId,
	        1,
	        a.SlID,
	        a.Description,
	        a.Description2,
	        case when b.SaleInvoiceStatus = 5 and b.ParentInvoiceID is not null then 0 else a.PriceInBaseCurrency end,
	        case when b.SaleInvoiceStatus = 5 and b.ParentInvoiceID is not null then a.PriceInBaseCurrency else 0 end,
	        a.CurrencyId,
	        a.CurrencyRate,
	        case when b.SaleInvoiceStatus = 5 and b.ParentInvoiceID is not null then 0 else a.Price end,
	        case when b.SaleInvoiceStatus = 5 and b.ParentInvoiceID is not null then a.Price else 0 end,
	        @CreatorId,
	        GETDATE(),
	        @CreatorId,
	        GETDATE(),
	        0 ,
			'InvoicePreReceive',
			InvoicePreReceiveID
		FROM #InvoicePreReceive a
		join #Invoices b on a.InvoiceID = b.InvoiceID
	    -- Insert	Discount	
	    IF (@IfDiscountVoucherable = 'true')
	    BEGIN
	        
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
	            a.PreVoucherID,
	            1,
	            a.SlID,
	            Description,
	            Description2,
	            case when b.SaleInvoiceStatus = 5 and ParentInvoiceID is not null then 0 else DiscountInBaseCurrency end,
	            case when b.SaleInvoiceStatus = 5 and ParentInvoiceID is not null then DiscountInBaseCurrency else 0 end,
	            CurrencyID,
	            CurrencyRate,
	            case when b.SaleInvoiceStatus = 5 and ParentInvoiceID is not null then 0 else Discount end,
	            case when b.SaleInvoiceStatus = 5 and ParentInvoiceID is not null then Discount else 0 end,
	            @CreatorId,
	            GETDATE(),
	            @CreatorId,
	            GETDATE(),
	            0,
				'InvoiceItem',
				InvoiceItemID			
	        FROM   #TItem a
			join #Invoices b on a.InvoiceID = b.InvoiceID
	        
	    END
	    
	    -- insert Percentage Cost
	    INSERT INTO ACC.PreVoucherItem (PreVoucherID ,RowIndex,SlID,DESCRIPTION , Description2,Debit,Credit,CurrencyID ,CurrencyRate, CurrencyDebit, CurrencyCredit,Creator,  CreationDate,LastEditor,LastEditionDate,Version,BaseDocumentName,BaseDocumentID)
		SELECT  PreVoucherId,
				1,
				@PercentageCost,
				CommissionExpenseDescription,
				CommissionExpenseDescription2, 
				case when SaleInvoiceStatus = 5 and ParentInvoiceID is not null then 0 else PercentageInBaseCurrency end,	   
				CASE WHEN SaleInvoiceStatus = 5 and ParentInvoiceID is not null then PercentageInBaseCurrency else 0 end ,     
				-1,
				1,
				case when SaleInvoiceStatus = 5 and ParentInvoiceID is not null then 0	else [Percentage] end		 ,
				case when SaleInvoiceStatus = 5 and ParentInvoiceID is not null then [Percentage]	else 0 end,
				@CreatorId,
				GETDATE(),
				@CreatorId,
				GETDATE(),
				0,
				'Invoice',
				InvoiceID
		from #Invoices
		where [Percentage] > 0
		
		


	    -- Insert	Tax		
	    INSERT INTO ACC.PreVoucherItem (PreVoucherID ,RowIndex	   ,SlID           ,DESCRIPTION , Description2,Debit,Credit,							 CurrencyID ,CurrencyRate, CurrencyDebit, CurrencyCredit,Creator,  CreationDate,LastEditor,LastEditionDate,Version,BaseDocumentName,BaseDocumentID)
	    SELECT  PreVoucherId,
				1,
				TaxSlID,
				TaxDescription,
				TaxDescription2,
				0,
				it.TotalBaseCurrencyTax ,
				-1,
				1,
				0,
				it.TotalBaseCurrencyTax ,
				@CreatorId,
				GETDATE(),
				@CreatorId,       
				GETDATE(),
				0,
				'Invoice',
				i.InvoiceID
		from #Invoices I
		join #InvoiceTotals it on i.InvoiceID = it.InvoiceID
		where it.TotalBaseCurrencyTax > 0
		
	    -- Insert	Duty		
	    INSERT INTO ACC.PreVoucherItem (PreVoucherID ,RowIndex	   ,SlID           ,DESCRIPTION , Description2,Debit,Credit,							 CurrencyID ,CurrencyRate, CurrencyDebit, CurrencyCredit,Creator,  CreationDate,LastEditor,LastEditionDate,Version,BaseDocumentName,BaseDocumentID)
	    SELECT  PreVoucherId,
				1,
				DutySlID,
				DutyDescription,
				DutyDescription2, 
				0,
				it.TotalBaseCurrencyDuty ,
				-1,
				1,
				0,
				it.TotalBaseCurrencyDuty ,
				@CreatorId,
				GETDATE(),
				@CreatorId,
				GETDATE(),
				0,
				'Invoice',
				i.InvoiceID
		from #Invoices I
		join #InvoiceTotals it on i.InvoiceID = it.InvoiceID
		where it.TotalBaseCurrencyDuty > 0
		
				
		
	    ---------------------------------------Sale-----------------------------------------------	
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
	        b.PreVoucherId,
	        1,
	        a.SlID,
	        Description,
	        Description2,
	        0,
	         SalePriceInBaseCurrencyToBeVoucherd,
	        CASE WHEN s.HasCurrency  = 1 then b.CurrencyID else -1 end,
	        CASE WHEN s.HasCurrency = 1 then b.CurrencyRate else 1 End,
	        0,
	        CASE WHEN s.HasCurrency = 1 then SalePriceToBeVouchered else SalePriceInBaseCurrencyToBeVoucherd end,
	        @CreatorId,
	        GETDATE(),
	        @CreatorId,
	        GETDATE(),
	        0 ,
			'InvoiceItem',
			InvoiceItemID
		FROM #Tinvoice a
		join #Invoices b on a.InvoiceID = b.InvoiceID
		join acc.SL AS s on a.SlID = s.SlID
	     
	     
	     
	     -- insert Percentage Payable
	    INSERT INTO ACC.PreVoucherItem (PreVoucherID ,RowIndex	   ,SlID           ,DESCRIPTION , Description2,Debit,Credit,							 CurrencyID ,CurrencyRate, CurrencyDebit, CurrencyCredit,Creator,  CreationDate,LastEditor,LastEditionDate,Version,BaseDocumentName,BaseDocumentID)
		SELECT  PreVoucherId,
				1,
				@PercentagePayable,
				PayableCommissionDescription,
				PayableCommissionDescription2, 
				case when SaleInvoiceStatus = 5 and ParentInvoiceID is not null then PercentageInBaseCurrency else 0 end,
				case when SaleInvoiceStatus = 5and ParentInvoiceID is not null then 0 else PercentageInBaseCurrency end, 
				-1,
				1,
				case when SaleInvoiceStatus = 5 and ParentInvoiceID is not null then [Percentage] else 0 end,
				case when SaleInvoiceStatus = 5 and ParentInvoiceID is not null then 0 else [Percentage]  end,
				@CreatorId,
				GETDATE(),
				@CreatorId,       
				GETDATE(),
				0,
				'Invoice',
				InvoiceID
	    from #Invoices
		where [Percentage] > 0
				
					
	    -----------------------------------AllocationSharing insert------------------
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
			b.PreVoucherID,
	        1,
	        ExchangeSlId,
	        ExchangeProfitLossDescription,
	        ExchangeProfitLossDescription2,
			case when SaleInvoiceStatus = 5 and ParentInvoiceID is not null 
					then
						case when AllocationSharingAmount < 0 then  0 else abs(AllocationSharingAmount) end
					else 
						case when AllocationSharingAmount < 0 then  abs(AllocationSharingAmount) else 0 end
				end,
			case when SaleInvoiceStatus = 5 and ParentInvoiceID is not null 
					then 
						case when AllocationSharingAmount > 0 then  0 else abs(AllocationSharingAmount) end
					else
						case when AllocationSharingAmount > 0 then  abs(AllocationSharingAmount) else 0 end
				end,
	        -1,
	        1,
			case when SaleInvoiceStatus = 5 and ParentInvoiceID is not null 
					then
						case when AllocationSharingAmount < 0 then  0 else abs(AllocationSharingAmount) end
					else 
						case when AllocationSharingAmount < 0 then  abs(AllocationSharingAmount) else 0 end
				end,
			case when SaleInvoiceStatus = 5 and ParentInvoiceID is not null 
					then 
						case when AllocationSharingAmount > 0 then  0 else abs(AllocationSharingAmount) end
					else
						case when AllocationSharingAmount > 0 then  abs(AllocationSharingAmount) else 0 end
				end,
	        1,
	        @CreatorId,
	        GETDATE(),
	        @CreatorId,
	        GETDATE(),
	        1,
			'InvoiceItem',
			InvoiceItemID
	    FROM   #TInvoice	    a
		join #Invoices b on a.InvoiceID = b.InvoiceID
		where AllocationSharingAmount <> 0

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
	               c.DLID,
	               NULL,
	               @CreatorId,
	               GETDATE(),
	               @CreatorId,
	               
	               GETDATE(),
	               0
		 from #Invoices h
		 join acc.prevoucheritem a on h.PrevoucherID = a.PreVoucherID
		 join acc.accountlevelsl b on a.slid = b.slid 
		 join acc.dl c on c.DLID = h.CustomerDlID and c.DlTypeID = b.DlTypeID
		 where a.SlID <> isnull(@PercentagePayable,0)

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
	               c.DLID,
	               NULL,
	               @CreatorId,
	               GETDATE(),
	               @CreatorId,
	               GETDATE(),
	               0
		 from #Invoices h
		 join acc.prevoucheritem a on h.PrevoucherID = a.PreVoucherID
		 join acc.accountlevelsl b on a.slid = b.slid 
		 join sle.saleagent sa on sa.SaleAgentID = h.SaleAgentID
		 JOIN cfg.party p ON p.partyid = sa.partyid
		 join acc.dl c on c.DLID = p.DlID and c.DlTypeID = b.DlTypeID
		 where a.SlID = @PercentagePayable

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
	               c.DLID,
	               NULL,
	               @CreatorId,
	               GETDATE(),
	               @CreatorId,
	               GETDATE(),
	               0
		 from #Invoices h
		 join acc.prevoucheritem a on h.PrevoucherID = a.PreVoucherID
		 join acc.accountlevelsl b on a.slid = b.slid 
		 join acc.dl c on c.DLID = h.CostCenterDlID and c.DlTypeID = b.DlTypeID
		 
		;with temp as 
		(
			select  [pi].PreVoucherItemID,
					ROW_NUMBER() over(partition by i.PreVoucherID order by debit desc,acc.SlFullCode(pi.slid) desc) RowIndex,
				REPLACE(
				REPLACE(
				REPLACE(
				REPLACE(
                REPLACE(
                REPLACE(
                REPLACE(
                REPLACE(
                REPLACE([pi].Description,
                '@@CurrencyTitle@@', ISNULL(i.CurrencyTitle, '')),
                '@@EconomicCode@@', ISNULL(EconomicCode, '')),
                '@@NationalCode@@', ISNULL(NationalCode, '')),
                '@@CustomerTitle@@', ISNULL(CustomerTitle, '')),
                '@@SaleAreaTitle@@', ISNULL(SaleArea, '')),
                '@@SaleTypeTitle@@', ISNULL(SaleType, '')),
                '@@Date_Gregorian@@', ISNULL(FullDateAlternateKey, '')),
                '@@Date_Solar@@', ISNULL(PersianFullDateAlternateKey, '')),
                '@@Number@@', ISNULL(i.Number, '')) [Description],
				    REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE([pi].Description2,
						'@@CurrencyTitle@@',isnull(i.CurrencyTitle2,'')),
						'@@EconomicCode@@',isnull(EconomicCode,'')),
						'@@NationalCode@@',isnull(NationalCode,'')),
						'@@CustomerTitle@@',isnull(CustomerTitle2,'')),
						'@@SaleAreaTitle@@',isnull(SaleArea2,'')),
						'@@SaleTypeTitle@@',isnull(SaleType2,'')),
						'@@Date_Gregorian@@',isnull(FullDateAlternateKey,'')),
						'@@Date_Solar@@',isnull(PersianFullDateAlternateKey,'')),
                        '@@Number@@', ISNULL(i.Number, '')) Description2
			from #Invoices i
			join  acc.PreVoucherItem [pi]  on [pi].PrevoucherID = i.PreVoucherID
		)

		update v
		set RowIndex = vi.RowIndex,
			Description = vi.Description,
			Description2 = vi.Description2
		from acc.PreVoucherItem v
		join temp vi  on v.PreVoucherItemID = vi.PreVoucherItemID

		update b
		set [Description] = 
		           REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(b.[Description],
						'@@CurrencyTitle@@',isnull(a.CurrencyTitle,'')),
						'@@EconomicCode@@',isnull(EconomicCode,'')),
						'@@NationalCode@@',isnull(NationalCode,'')),
						'@@CustomerTitle@@',isnull(CustomerTitle,'')),
						'@@SaleAreaTitle@@',isnull(SaleArea,'')),
						'@@SaleTypeTitle@@',isnull(SaleType,'')),
						'@@Date_Gregorian@@',isnull(FullDateAlternateKey,'')),
						'@@Date_Solar@@',isnull(PersianFullDateAlternateKey,'')),
						'@@Number@@',isnull(a.Number,'')),
					Description2 =
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(b.Description2,
						'@@CurrencyTitle@@',isnull(a.CurrencyTitle2,'')),
						'@@EconomicCode@@',isnull(EconomicCode,'')),
						'@@NationalCode@@',isnull(NationalCode,'')),
						'@@CustomerTitle@@',isnull(CustomerTitle2,'')),
						'@@SaleAreaTitle@@',isnull(SaleArea2,'')),
						'@@SaleTypeTitle@@',isnull(SaleType2,'')),
						'@@Date_Gregorian@@',isnull(FullDateAlternateKey,'')),
						'@@Date_Solar@@',isnull(PersianFullDateAlternateKey,'')),
						'@@Number@@',isnull(a.Number,''))
		from #Invoices a
		join acc.PreVoucher b on a.PrevoucherID = b.PreVoucherID

