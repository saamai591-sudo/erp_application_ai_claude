
----------Start of #7975
CREATE   PROCEDURE [SLE].spInvoiceCorrectionPreVoucherInsert
	@InvoiceId NVARCHAR(MAX)	

--WITH ENCRYPTION 
	 AS 
	    DECLARE @DocumentNumTypeId		INT = (SELECT Top 1  DocumentNumTypeID  FROM   CFG.DocumentNumType  WHERE EngName = 'InvoiceCorrection'),
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

	    --- FetchValues ---
		select @MaxPrevoucherID = MAX(PreVoucherID)
		from acc.PreVoucher

	    SELECT  isnull(@MaxPrevoucherID,0) + ROW_NUMBER() over(order by ci.InvoiceCorrectionID) PrevoucherID,
				ci.Number,
				p.DlID  CustomerDlID ,
				ci.BranchID,
				ci.FinancialPeriodID,
				i.CurrencyID,
				i.CurrencyRate,
				cI.Date,
				c.ExchangeUnit,
				it.slid,
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
				it.TaxSlID,
				it.DutySlID,
				ci.InvoiceCorrectionID
			into #InvoicesCorrection
	    FROM   sle.InvoiceCorrection ci 
		JOIN #DocumentIds b on ci.InvoiceCorrectionID = b.ID
		join sle.Invoice i on i.InvoiceID = ci.ParentInvoiceID
		JOIN sle.SaleType it on it.SaleTypeID = i.SaleTypeID
	    JOIN cfg.party p  ON  i.CustomerID = p.PartyID
		JOIN cfg.Currency c on c.CurrencyID = i.CurrencyID
		LEFT JOIN sle.salearea sa on sa.SaleAreaID = i.SaleAreaID
		LEFT JOIN cfg.CostCenter cc on cc.CostCenterID = sa.CostCenterID
		JOIN cfg.DimDate DD on DD.Date = i.Date
		where ci.PreVoucherID is null
		 
	    SELECT TOP 1 @IfDiscountVoucherable = LOWER(configvalue)
	    FROM   CFG.Configuration
	    WHERE  ConfigKey = 'SaleVoucherWithDiscount'
			   		 
	    SELECT  b.InvoiceCorrectionID,
				ici.InvoiceCorrectionItemID,
	            sm.SaleSlID AS Slid,
				REPLACE(
				REPLACE(@SaleDescription,
					'@@StuffTitle@@',vw.Title)				,
					'@@ItemDescription@@',isnull(it.Description,'')) [Description],
				REPLACE(
				REPLACE(@SaleDescription2,
					'@@StuffTitle@@',vw.Title2)				,
					'@@ItemDescription@@',isnull(it.Description2,'')) [Description2],
	            case  when @ifdiscountvoucherable='true' and IsBaseCurrencyBasis = 0 
							then ROUND(ici.PriceDifference * CurrencyRate / ExchangeUnit,@BaseDigit)
						when @ifdiscountvoucherable='true' and IsBaseCurrencyBasis = 1
							then ROUND(ici.PriceDifference * ExchangeUnit / CurrencyRate ,@BaseDigit)
						when @ifdiscountvoucherable='false' and IsBaseCurrencyBasis = 0 
							then ROUND((ici.PriceDifference - ici.DiscountDifference) * CurrencyRate / ExchangeUnit,@BaseDigit)
						when @ifdiscountvoucherable='false' and IsBaseCurrencyBasis = 1
							then ROUND((ici.PriceDifference - ici.DiscountDifference) *ExchangeUnit / CurrencyRate,@BaseDigit)
						end SalePriceInBaseCurrency,
	            case  when @ifdiscountvoucherable='true' 
							then ici.PriceDifference
						when @ifdiscountvoucherable='false' 
							then ici.PriceDifference - ici.DiscountDifference
						end SalePrice,
				vw.StuffAccountGroupID,
				b.PrevoucherID,
				b.CustomerDlID DlID,
				@ExchangeProfitLossDescription ExchangeProfitLossDescription,
				@ExchangeProfitLossDescription2 ExchangeProfitLossDescription2,
				case when IsBaseCurrencyBasis = 0
					then 
						ROUND(DiscountDifference*CurrencyRate/ExchangeUnit,@BaseDigit)
				when IsBaseCurrencyBasis = 1
					then
						ROUND(DiscountDifference*ExchangeUnit/CurrencyRate,@BaseDigit)
						end  DiscountInBaseCurrency,
				ici.DiscountDifference Discount,
				sm.DiscountSlID,
				case when IsBaseCurrencyBasis = 0
					then 
						ROUND(VatDifference*CurrencyRate/ExchangeUnit,@BaseDigit)
				when IsBaseCurrencyBasis = 1
					then
						ROUND(VatDifference*ExchangeUnit/CurrencyRate,@BaseDigit)
						end  VatInBaseCurrency,
				ici.VatDifference Vat
	            INTO #TInvoice
	    FROM  sle.InvoiceCorrectionItem ici
		join Sle.InvoiceItem It on it.InvoiceItemID = ici.InvoiceItemID
		join #InvoicesCorrection b on ici.InvoiceCorrectionID = b.InvoiceCorrectionID
		join stf.VWStuff vw on vw.stuffid = it.StuffID
		left join stf.StuffAccountGroup sag on sag.StuffAccountGroupID = vw.StuffAccountGroupID
	    left JOIN stf.StuffSaleSl sm ON  vw.StuffAccountGroupID = sm.StuffAccountGroupID
										and sm.SaleModelID = it.SaleModelID
	    WHERE 
				((@ifdiscountvoucherable='false' and (ici.PriceDifference - ici.DiscountDifference) <> 0 )
				or
				(@ifdiscountvoucherable='true' and ici.PriceDifference <> 0)
				)

		update b 
		set ErrorMessage = N'SLE_spInvoicePreVoucherInsert_11^'+cast(Number as varchar(50))+char(10)+char(13)
		from #TInvoice a
		join #InvoicesCorrection b on a.InvoiceCorrectionID = b.InvoiceCorrectionID
		where a.Slid is null 

		update #InvoicesCorrection
		set ErrorMessage = isnull(ErrorMessage,'') + N'SLE_spInvoicePreVoucherInsert_4^'+cast(Number as varchar(50))+char(10)+char(13)
		from #TInvoice a
		join #InvoicesCorrection b on a.InvoiceCorrectionID = b.InvoiceCorrectionID
		where a.SalePrice = 0 

		update a
		set ErrorMessage = isnull(ErrorMessage,'') + N'SLE_spInvoicePreVoucherInsert_12^'+cast(Number as varchar(50))+char(10)+char(13)
		from #InvoicesCorrection  a
		join #TInvoice b on a.InvoiceCorrectionID = b.InvoiceCorrectionID
		where Discount <> 0 and  b.DiscountSlID IS null and  (@IfDiscountVoucherable = 'true')

		if exists (select * from #InvoicesCorrection where ErrorMessage is not null )
		BEGIN	
			select InvoiceCorrectionID,ErrorMessage from #InvoicesCorrection
			RETURN;
	    END

	    -- Insert Into PreVoucher Tabel
		set identity_insert [ACC].[PreVoucher] on
	    INSERT INTO [ACC].[PreVoucher]([PreVoucherID],[BranchID],[DocumentNumtypeID],[Date],[FinancialPeriodID],[Description],[Description2],[Creator],[CreationDate],[LastEditor],[LastEditionDate],[Version])
		SELECT [PreVoucherID],BranchId,@DocumentNumTypeId,date,FinancialPeriodID,HeaderDescription,HeaderDescription2,@CreatorId,GETDATE(),@CreatorId,GETDATE(),0
		from #InvoicesCorrection
		set identity_insert [ACC].[PreVoucher] off

	    UPDATE a
	    SET    PreVoucherID = b.PreVoucherId
		from sle.InvoiceCorrection a
		join #InvoicesCorrection b on a.InvoiceCorrectionID = b.InvoiceCorrectionID

		-------------------- Insert AccountsReceivable	------------------------
	    INSERT INTO ACC.PreVoucherItem (PreVoucherID ,RowIndex,SlID,DESCRIPTION , Description2,Debit,Credit,CurrencyID ,CurrencyRate, CurrencyDebit, CurrencyCredit,Creator,  CreationDate,LastEditor,LastEditionDate,Version,BaseDocumentName,BaseDocumentID)
	    SELECT	PreVoucherId,
				1,
				SlID,
				ReceivableAccountsDescription,
				ReceivableAccountsDescription2,
				case when SalePriceInBaseCurrency 
						  - case when @ifdiscountvoucherable='true' then isnull(DiscountInBaseCurrency,0) else 0 end 
					      + VatInBaseCurrency > 0
					then
						  SalePriceInBaseCurrency 
						  - case when @ifdiscountvoucherable='true' then isnull(DiscountInBaseCurrency,0) else 0 end 
						  + VatInBaseCurrency
					else 0
					end,	
				case when SalePriceInBaseCurrency 
						  - case when @ifdiscountvoucherable='true' then isnull(DiscountInBaseCurrency,0) else 0 end 
					      + VatInBaseCurrency < 0
					then abs(
						  SalePriceInBaseCurrency 
						  - case when @ifdiscountvoucherable='true' then isnull(DiscountInBaseCurrency,0) else 0 end 
						  + VatInBaseCurrency)
					else 0
					end,	
				CurrencyId,
				CurrencyRate,
				case when SalePrice 
						  - case when @ifdiscountvoucherable='true' then isnull(Discount,0) else 0 end 
					      + Vat > 0
					then
						  SalePrice
						  - case when @ifdiscountvoucherable='true' then isnull(Discount,0) else 0 end 
						  + Vat
					else 0
					end,	
				case when SalePrice 
						  - case when @ifdiscountvoucherable='true' then isnull(Discount,0) else 0 end 
					      + Vat < 0
					then abs(
						  SalePrice
						  - case when @ifdiscountvoucherable='true' then isnull(Discount,0) else 0 end 
						  + Vat)
					else 0
					end,
				@CreatorId,
				GETDATE(),
				@CreatorId,
				GETDATE(),
				0,
				'InvoiceCorrection',
				a.InvoiceCorrectionID
		from #InvoicesCorrection a
		left join 
			(
			select  InvoiceCorrectionID,
					sum(SalePriceInBaseCurrency)	 SalePriceInBaseCurrency,
					sum(DiscountInBaseCurrency) DiscountInBaseCurrency,
					sum(VatInBaseCurrency) VatInBaseCurrency,
					sum(SalePrice) SalePrice,
					sum(Discount) Discount,
					sum(Vat) Vat
			from #TInvoice
			group by InvoiceCorrectionID
			)b on a.InvoiceCorrectionID = b.InvoiceCorrectionID
		where 		SalePriceInBaseCurrency - 
					case when @ifdiscountvoucherable='true' then isnull(DiscountInBaseCurrency,0) else 0 end +
					VatInBaseCurrency <> 0
	    
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
	            case when DiscountInBaseCurrency > 0 then DiscountInBaseCurrency else 0 end,
	            case when DiscountInBaseCurrency < 0 then abs(DiscountInBaseCurrency) else 0 end,
	            CurrencyID,
	            CurrencyRate,
	            case when DiscountInBaseCurrency > 0 then Discount else 0 end,
	            case when DiscountInBaseCurrency < 0 then abs(Discount) else 0 end,
	            @CreatorId,
	            GETDATE(),
	            @CreatorId,
	            GETDATE(),
	            0,
				'InvoiceCorrectionItem',
				InvoiceCorrectionItemID			
	        FROM   #TInvoice a
			join #InvoicesCorrection b on a.InvoiceCorrectionID = b.InvoiceCorrectionID
			where Discount <> 0
	        
	    END
	    
	    -- Insert	VAT		
	    INSERT INTO ACC.PreVoucherItem (PreVoucherID ,RowIndex	   ,SlID           ,DESCRIPTION , Description2,Debit,Credit,							 CurrencyID ,CurrencyRate, CurrencyDebit, CurrencyCredit,Creator,  CreationDate,LastEditor,LastEditionDate,Version,BaseDocumentName,BaseDocumentID)
	    SELECT  PreVoucherId,
				1,
				TaxSlID,
				TaxDescription,
				TaxDescription2,
				case when VatInBaseCurrency > 0 then 0 else  abs(VatInBaseCurrency) end,
				case when VatInBaseCurrency < 0 then 0 else  VatInBaseCurrency end,
				-1,
				1,
				case when VatInBaseCurrency > 0 then 0 else  abs(VatInBaseCurrency) end,
				case when VatInBaseCurrency < 0 then 0 else  VatInBaseCurrency end,
				@CreatorId,
				GETDATE(),
				@CreatorId,       
				GETDATE(),
				0,
				'InvoiceCorrection',
				a.InvoiceCorrectionID
		from #InvoicesCorrection a
		left join 
			(
			select  InvoiceCorrectionID,
					sum(VatInBaseCurrency) VatInBaseCurrency,
					sum(Vat) Vat
			from #TInvoice
			group by InvoiceCorrectionID
			)b on a.InvoiceCorrectionID = b.InvoiceCorrectionID
		where 		VatInBaseCurrency <> 0
		
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
	        a.PreVoucherId,
	        1,
	        a.SlID,
	        Description,
	        Description2,
	        case when SalePriceInBaseCurrency < 0 then abs(SalePriceInBaseCurrency) else 0 end,
	        case when SalePriceInBaseCurrency > 0 then SalePriceInBaseCurrency else 0 end,
	        CurrencyID,
	        CurrencyRate,
	        case when SalePrice < 0 then abs(SalePrice) else 0 end,
	        case when SalePrice > 0 then SalePrice else 0 end,
	        @CreatorId,
	        GETDATE(),
	        @CreatorId,
	        GETDATE(),
	        0 ,
			'InvoiceCorrection',
			a.InvoiceCorrectionID
		FROM #Tinvoice a
		join #InvoicesCorrection b on a.InvoiceCorrectionID = b.InvoiceCorrectionID

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
		 from #InvoicesCorrection h
		 join acc.prevoucheritem a on h.PrevoucherID = a.PreVoucherID
		 join acc.accountlevelsl b on a.slid = b.slid 
		 join acc.dl c on c.DLID = h.CustomerDlID and c.DlTypeID = b.DlTypeID
		 where a.SlID = h.SlID

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
		 from #InvoicesCorrection h
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
			from #InvoicesCorrection i
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
		from #InvoicesCorrection a
		join acc.PreVoucher b on a.PrevoucherID = b.PreVoucherID
