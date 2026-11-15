
------------------------------------- START #8331
CREATE   PROCEDURE [VND].spPurchaseInvoicePreVoucherInsert
	@PurchaseInvoiceId NVARCHAR(MAX)
--WITH ENCRYPTION
AS
	    DECLARE @DocumentNumTypeId          INT = (
													SELECT DNT.DocumentNumTypeID
													FROM   CFG.DocumentNumType DNT
													WHERE  DNT.EngName = 'PurchaseInvoice'
												  ),
				@MDEntity INT = (select Top 1 Id from mdt.DmdEntity where Name = 'PurchaseInvoice'),
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
				@DownPaymentDescription nvarchar(max),
				@DownPaymentDescription2 nvarchar(max),
				@ExchangeProfitLossDescription nvarchar(max),
				@ExchangeProfitLossDescription2 nvarchar(max),
				@DeductionDescription  nvarchar(max),
				@DeductionDescription2 nvarchar(max),
	            @BaseDigit             DECIMAL(18, 4),
	            @CultureNO                  INT,
	            @PurchaseInvoicePrevoucherMode BIT,
				@creatorId INT ,
				@Culture VARCHAR(10),
				@MaxPrevoucherID int
	    
		SELECT [value] ID
		INTO #DocumentIds
		FROM   cfg.R_FnCommaStr2Table(@PurchaseInvoiceId) 

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

		select  @DownPaymentDescription = Description,
				@DownPaymentDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'DownPayment'

		select  @ExchangeProfitLossDescription = Description,
				@ExchangeProfitLossDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'ExchangeProfitLoss'

		select  @DeductionDescription = Description,
				@DeductionDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'Deduction'

	    SELECT @PurchaseInvoicePrevoucherMode = ISNULL(c.ConfigValue, 0)
	    FROM   cfg.Configuration AS c
	    WHERE  c.ConfigKey = 'PurchasePrevoucherIsNet'
	    
		select @MaxPrevoucherID = max(PreVoucherID)
		from acc.PreVoucher
		
	    SELECT  vpi.PurchaseInvoiceID,
				isnull(@MaxPrevoucherID,0) + ROW_NUMBER() over(order by vpi.PurchaseInvoiceID) PrevoucherID,
				vpi.CurrencyID,
	            vpi.CurrencyRate,
	            c.ExchangeUnit,
	            IsBaseCurrencyBasis,
	            vpi.DlID,
	            ContractSubject.DLID ContractDLID,
	            branchid,
	            vpi.FinancialPeriodID,
	            vpi.Number,
				Vpi.InvoiceNumber,
	            vpi.BaseType,
	            vpi.DATE invoicedate,
	            pt.SlID,
	            ExchangeManner,
	            pt.TaxSlId,
	            pt.DutySlId,
	            pt.Title PurchaseTypeTitle1,
	            pt.Title2 PurchaseTypeTitle2, 
	            STATUS,
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
				 DD1.FullDateAlternateKey InvoiceDate_FullDateAlternateKey,
				 DD1.PersianFullDateAlternateKey InvoiceDate_PersianFullDateAlternateKey,
				 dl.Title DLTitle,
				 dl.Title2 DLTitle2,
				 pt.PurchaseTypeID,
				 pt.HasConfirmStatement
			into #PurchaseInvoice
	    FROM   VND.PurchaseInvoice vpi
		JOIN #DocumentIds ids on ids.ID = vpi.PurchaseInvoiceID
		JOIN cfg.DimDate DD on DD.Date = vpi.Date
		left JOIN cfg.DimDate DD1 on DD1.Date = vpi.InvoiceDate
	    JOIN acc.DL  ON  dl.DlID = vpi.DlID
	    JOIN vnd.PurchaseType pt
	        ON  pt.PurchaseTypeID = vpi.Type
	    JOIN cfg.Currency c
	        ON  c.CurrencyID = vpi.CurrencyID
	    LEFT JOIN (
	            SELECT PurchaseInvoiceID,
	                    b.DLID
	            FROM   VND.PurchaseInvoiceItem pii
	            JOIN cnt.vwContractSubject a
	                ON  pii.ContractSubjectID = a.ContractSubjectID
	            JOIN cnt.Contract b
	                ON  a.ContractID = b.ContractID
	            GROUP BY
	                    PurchaseInvoiceID,
	                    b.DLID
				)ContractSubject
	        ON  ContractSubject.PurchaseInvoiceID = vpi.PurchaseInvoiceID
		where vpi.PreVoucherID is null
	    
		update #PurchaseInvoice 
		set ErrorMessage = N'سند حسابداری فاکتورهای خریدی که دارای تایید مالی هستند در فرم تایید مالی فاکتور خرید صادر می شود'+char(10)+char(13)
		where HasConfirmStatement = 1

		if exists (select * from #PurchaseInvoice where ErrorMessage is not null )
		BEGIN	
			select PurchaseInvoiceID,ErrorMessage from #PurchaseInvoice
			RETURN;
	    END		

		update #PurchaseInvoice 
		set ErrorMessage = isnull(ErrorMessage,'') + N'SLE_spInvoicePreVoucherInsert_5^'+cast(Number as varchar(10))+char(10)+char(13)
		where status <> 2

		update #PurchaseInvoice 
		set ErrorMessage = isnull(ErrorMessage,'') + N'PreTaxSlNotSpecifiedInPurchaseType^'+CASE WHEN @CultureNO = 1 then PurchaseTypeTitle1 else PurchaseTypeTitle2 end +char(10)+char(13)
		where TaxSlId is null

		update #PurchaseInvoice 
		set ErrorMessage = isnull(ErrorMessage,'') + N'PreDutySlNotSpecifiedInPurchaseType^'+CASE WHEN @CultureNO = 1 then PurchaseTypeTitle1 else PurchaseTypeTitle2 END +char(10)+char(13)
		where DutySlId is null

		if exists (select * from #PurchaseInvoice where ErrorMessage is not null )
		BEGIN	
			select PurchaseInvoiceID,ErrorMessage from #PurchaseInvoice
			RETURN;
	    END
	    		
	    SELECT PurchaseInvoicePrePaymentID,
	           CASE 
	                WHEN pip.PaymentSubjectID IS NOT NULL THEN pt.SLID
	                WHEN pip.DebitCreditNoteItemID IS NOT NULL THEN pt2.SLID
	                WHEN pip.PettyCashCostItemID IS NOT NULL THEN pt3.SLID
	           END     SLID,
	           pip.Price,
	           CASE 
	                WHEN pip.PaymentSubjectID IS NOT NULL AND c.IsBaseCurrencyBasis = 0 THEN ROUND(pip.Price * ps.CurrencyRate / c.ExchangeUnit, @BaseDigit)
	                WHEN pip.PaymentSubjectID IS NOT NULL AND c.IsBaseCurrencyBasis = 1 THEN ROUND(pip.Price * c.ExchangeUnit / ps.CurrencyRate, @BaseDigit)
	                WHEN pip.DebitCreditNoteItemID IS NOT NULL AND c2.IsBaseCurrencyBasis = 0 THEN ROUND(
	                         pip.Price * dcni.CurrencyRate / c2.ExchangeUnit,
	                         @BaseDigit
	                     )
	                WHEN pip.DebitCreditNoteItemID IS NOT NULL AND c2.IsBaseCurrencyBasis = 1 THEN ROUND(
	                         pip.Price * c2.ExchangeUnit / dcni.CurrencyRate,
	                         @BaseDigit
	                     )
	                WHEN pip.PettyCashCostItemID IS NOT NULL AND c3.IsBaseCurrencyBasis = 0 THEN ROUND(pip.Price * pcc.CurrencyRate / c3.ExchangeUnit, @BaseDigit)
	                WHEN pip.PettyCashCostItemID IS NOT NULL AND c3.IsBaseCurrencyBasis = 1 THEN ROUND(pip.Price * c3.ExchangeUnit / pcc.CurrencyRate, @BaseDigit)
	           END     PriceInBaseCurrency,
	           CASE 
	                WHEN pip.PaymentSubjectID IS NOT NULL THEN ps.CurrencyID
	                WHEN pip.DebitCreditNoteItemID IS NOT NULL THEN dcni.CurrencyID
	                WHEN pip.PettyCashCostItemID IS NOT NULL THEN pc.CurrencyID
	           END     CurrencyID,
	           CASE 
	                WHEN pip.PaymentSubjectID IS NOT NULL THEN ps.CurrencyRate
	                WHEN pip.DebitCreditNoteItemID IS NOT NULL THEN dcni.CurrencyRate
	                WHEN pip.PettyCashCostItemID IS NOT NULL THEN pcc.CurrencyRate
	           END     CurrencyRate,
			   h.PurchaseInvoiceID,
			   @DownPaymentDescription DownPaymentDescription,
			   @DownPaymentDescription2 DownPaymentDescription2
	    INTO   #PurchaseInvoicePrePayment
	    FROM   [VND].[PurchaseInvoicePrePayment] pip
		JOIN #PurchaseInvoice h on h.PurchaseInvoiceID = pip.PurchaseInvoiceID
	    LEFT JOIN fin.PaymentSubject ps
	        ON  ps.PaymentSubjectID = pip.PaymentSubjectID
	    LEFT JOIN fin.PaymentType pt
	        ON  pt.PaymentTypeID = ps.PaymentTypeID
	    LEFT JOIN vnd.PurchaseInvoice PI
	        ON  PI.PurchaseInvoiceID = pip.PurchaseInvoiceID
	    LEFT JOIN cfg.Currency c
	        ON  c.CurrencyID = PI.CurrencyID
	    LEFT JOIN cfg.DebitCreditNoteItem dcni
	        ON  dcni.DebitCreditNoteItemID = pip.DebitCreditNoteItemID
	    LEFT JOIN fin.PaymentType pt2
	        ON  pt2.PaymentTypeID = dcni.PaymentTypeID
	    LEFT JOIN cfg.Currency c2
	        ON  c2.CurrencyID = dcni.CurrencyID
	    LEFT JOIN fin.PettyCashCostItem pcci
	        ON  pcci.PettyCashCostItemID = pip.PettyCashCostItemID
	    LEFT JOIN fin.PaymentType pt3
	        ON  pt3.PaymentTypeID = pcci.PaymentTypeID
	    LEFT JOIN fin.PettyCashCost pcc
	        ON  pcc.PettyCashCostID = pcci.PettyCashCostID
	    LEFT JOIN fin.PettyCash pc
	        ON  pc.PettyCashID = pcc.PettyCashID
	    LEFT JOIN cfg.Currency c3
	        ON  c3.CurrencyID = pc.CurrencyID

	    SELECT CASE 
	    	        WHEN s.type = 1 THEN sd.SlID
	    	        ELSE sagpt.SlID
	    	    END               Slid,
	    	    s.[Type]       AS StuffType,
	    	    s.Code         AS StuffCode,
	    	    case when it.IsVatPartOfCost = 1 then  It.Price + it.Tax + it.Duty - It.Discount else It.Price  - It.Discount end net,
	    	    CASE 
	    	        WHEN IsBaseCurrencyBasis = 0 THEN 
					ROUND(
	    	                    (case when it.IsVatPartOfCost = 1 then  It.Price + it.Tax + it.Duty - It.Discount else It.Price  - It.Discount end) * currencyrate / ExchangeUnit,
	    	                    @BaseDigit
	    	                )
	    	        WHEN IsBaseCurrencyBasis = 1 THEN 
					ROUND(
	    	                    (case when it.IsVatPartOfCost = 1 then  It.Price + it.Tax + it.Duty - It.Discount else It.Price  - It.Discount end) * ExchangeUnit / currencyrate,
	    	                    @BaseDigit
	    	                )
	    	    END               NetInBaseCurrency,
	    	    case when it.IsVatPartOfCost = 1 then 0 else It.Tax end Tax,
	    	    case when it.IsVatPartOfCost = 1 then 0 else It.Duty end Duty,
	    	    case when it.IsVatPartOfCost = 1 then 0 else
				CASE 
	    	        WHEN IsBaseCurrencyBasis = 0 THEN ROUND((It.Tax) * currencyrate / ExchangeUnit, @BaseDigit)
	    	        WHEN IsBaseCurrencyBasis = 1 THEN ROUND((It.Tax) * ExchangeUnit / currencyrate, @BaseDigit)
	    	    END        end       TaxInBaseCurrency,
				case when it.IsVatPartOfCost = 1 then 0 else
	    	    CASE 
	    	        WHEN IsBaseCurrencyBasis = 0 THEN ROUND((It.Duty) * currencyrate / ExchangeUnit, @BaseDigit)
	    	        WHEN IsBaseCurrencyBasis = 1 THEN ROUND((It.Duty) * ExchangeUnit / currencyrate, @BaseDigit)
	    	    END       end        DutyInBaseCurrency,
	    	    isnull(AllocationSharingAmount,0) AllocationSharingAmount,
	    	    sag.ExchangeSlId,
				REPLACE(@PurchaseControlDescription,'@@ItemDescription@@',isnull(it.[Description],'')) PurchaseControlDescription,
				REPLACE(@PurchaseControlDescription2,'@@ItemDescription@@',isnull(it.[Description2],'')) PurchaseControlDescription2,
				h.PurchaseInvoiceID,
				h.PrevoucherID,
				h.CurrencyID,
				h.CurrencyRate,
				h.ExchangeManner,
				@ExchangeProfitLossDescription ExchangeProfitLossDescription,
				@ExchangeProfitLossDescription2 ExchangeProfitLossDescription2,
				PurchaseInvoiceItemID,
				it.RowIndex
	    INTO   #TItem
	    FROM   vnd.purchaseInvoiceItem It
		INNER JOIN #PurchaseInvoice h on h.PurchaseInvoiceID = It.PurchaseInvoiceID
	    INNER JOIN STF.[Stuff] s
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
		from #PurchaseInvoice a
		join #Titem b on a.PurchaseInvoiceID = b.PurchaseInvoiceID
		where b.SlId is null

		update a 
		set ErrorMessage = isnull(ErrorMessage,'') + 'ExchangeCurrencyBenefitNotSpecified' +char(10)+char(13)
		from #PurchaseInvoice a
		join #Titem b on a.PurchaseInvoiceID = b.PurchaseInvoiceID
		where ISNULL(AllocationSharingAmount,0) <> 0 AND ExchangeSlID IS NULL and a.ExchangeManner = 1

		if exists (select * from #PurchaseInvoice where ErrorMessage is not null )
		BEGIN	
			select PurchaseInvoiceID,ErrorMessage from #PurchaseInvoice
			RETURN;
	    END

	    -------------------------------------------------get deduction values------------------------------------------------
	    SELECT m.SlID,
	           cs.Deduction,
	           CASE 
	                WHEN IsBaseCurrencyBasis = 0 THEN ROUND(Deduction * currencyrate / ExchangeUnit, @BaseDigit)
	                WHEN IsBaseCurrencyBasis = 1 THEN ROUND(Deduction * ExchangeUnit / currencyrate, @BaseDigit)
	           END DeductionInBaseCurrency,
	           REPLACE(
			   REPLACE(@DeductionDescription,'@@DeductionItemTitle@@',adt.Title)
					   ,'@@DeductionItemDescription@@',isnull(cs.Description,'')) Description,
	           REPLACE(
			   REPLACE(@DeductionDescription2,'@@DeductionItemTitle@@',adt.Title2)
					   ,'@@DeductionItemDescription@@',isnull(cs.Description2,'')) Description2,
			   h.PurchaseInvoiceID,
			   h.PrevoucherID,
			   h.CurrencyID,
			   h.CurrencyRate,
			   ConfirmStatementItemID
	    INTO   #Deduction
	    FROM   cnt.ConfirmStatementItem cs
		JOIN #PurchaseInvoice h on h.PurchaseInvoiceID = cs.PurchaseInvoiceID
	    JOIN cnt.AdditionDeductionType adt
	        ON  adt.AdditionDeductionTypeID = cs.AdditionDeductionTypeID
	    JOIN cnt.AdditionDeductionTypeMethod m
	        ON  m.AdditionDeductionTypeMethodID = cs.AdditionDeductionTypeMethodID
	    WHERE  adt.Type = 2
	           AND Criterion <> 2
	           
	    -----------------------------------insert in prevoucher------------------
		set identity_insert [ACC].[PreVoucher] on
	    INSERT INTO [ACC].[PreVoucher]
	      ( [PreVoucherID],
	        [BranchID],
	        [DocumentNumtypeID],
	        [Date],
	        [FinancialPeriodID],
	        [Description],
	        [Description2],
	        [Creator],
	        [CreationDate],
	        [LastEditor],
	        [LastEditionDate],
	        [Version]
	      )
	    SELECT [PreVoucherID],
			   BranchId,
	           @DocumentNumTypeId,
	           invoicedate,
	           FinancialPeriodID,
	           HeaderDescription,
	           HeaderDescription2,
	           @CreatorId,
	           GETDATE(),
	           @CreatorId,
	           GETDATE(),
	           0
	    from #PurchaseInvoice
	    set identity_insert [ACC].[PreVoucher] off
	    
	    UPDATE a
	    SET    PreVoucherID = b.PreVoucherId
		from VND.PurchaseInvoice a
		join #PurchaseInvoice b on a.PurchaseInvoiceID = b.PurchaseInvoiceID

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
	    	    PurchaseControlDescription,
	    	    PurchaseControlDescription2, 
				NetInBaseCurrency,
	    	    0,
	    	    case when b.HasCurrency = 1 then CurrencyId else -1 end,
	    	    case when b.HasCurrency = 1 then currencyrate else 1 end,
				case when b.HasCurrency = 1 then net else NetInBaseCurrency end,
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
	    ORDER BY a.RowIndex 
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
				PayableAccountsDescription,
				PayableAccountsDescription2,
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
			join #PurchaseInvoice b on a.PurchaseInvoiceID = b.PurchaseInvoiceID	
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
	            TaxDescription,
	            TaxDescription2,
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
		join #PurchaseInvoice b on a.PurchaseInvoiceID = b.PurchaseInvoiceID
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
	            DutyDescription,
	            DutyDescription2,
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
		join #PurchaseInvoice b on a.PurchaseInvoiceID = b.PurchaseInvoiceID
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
	        PayableAccountsDescription,
	        PayableAccountsDescription2,
	        0,
			TaxInBaseCurrency + DutyInBaseCurrency ,
	        -1,
	        1,
	        0,
			TaxInBaseCurrency + DutyInBaseCurrency,
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
		select  PurchaseInvoiceID, SUM(TaxInBaseCurrency) TaxInBaseCurrency, SUM(DutyInBaseCurrency) DutyInBaseCurrency
		from #TItem
		group by PurchaseInvoiceID
		)a
		join #PurchaseInvoice b on a.PurchaseInvoiceID = b.PurchaseInvoiceID	
		where  TaxInBaseCurrency + DutyInBaseCurrency <> 0
	    -----------------------------------Prepayment insert------------------
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
					PayableAccountsDescription,
					PayableAccountsDescription,
					PriceInBaseCurrency + ISNULL(AllocationSharingAmount, 0) ,
					0,
					CurrencyId,
					currencyrate,
					Price,
					0,
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
			select PurchaseInvoiceID,SUM(Price) Price,SUM(PriceInBaseCurrency) PriceInBaseCurrency
			from #PurchaseInvoicePrePayment
			group by PurchaseInvoiceID
			)a
			join #PurchaseInvoice b on a.PurchaseInvoiceID = b.PurchaseInvoiceID	     
			join
			(
			select  PurchaseInvoiceID,
					sum(AllocationSharingAmount) AllocationSharingAmount
			from #TItem
			group by PurchaseInvoiceID
			)c on c.PurchaseInvoiceID = a.PurchaseInvoiceID
		end
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
	    SELECT  PreVoucherId,
	            1,
	            a.SLID,
	            DownPaymentDescription,
	            DownPaymentDescription2,
	            0,
	            PriceInBaseCurrency,
	            a.CurrencyId,
	            a.currencyrate,
	            0,
	            Price,
	            1,
	            @CreatorId,
	            GETDATE(),
	            @CreatorId,
	            GETDATE(),
	            0,
				'PurchaseInvoicePrePayment',
				PurchaseInvoicePrePaymentID
	    FROM   #PurchaseInvoicePrePayment a
		join #PurchaseInvoice b on a.PurchaseInvoiceID = b.PurchaseInvoiceID
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
	    SELECT  PreVoucherID,
	            1,
	            ExchangeSlId,
	            ExchangeProfitLossDescription,
	            ExchangeProfitLossDescription2,
	            CASE 
	                WHEN AllocationSharingAmount < 0 THEN ABS(AllocationSharingAmount)
	                ELSE 0
	            END,
	            CASE 
	                WHEN AllocationSharingAmount > 0 THEN ABS(AllocationSharingAmount)
	                ELSE 0
	            END,
	            -1,
	            1,
	            CASE 
	                WHEN AllocationSharingAmount < 0 THEN ABS(AllocationSharingAmount)
	                ELSE 0
	            END,
	            CASE 
	                WHEN AllocationSharingAmount > 0 THEN ABS(AllocationSharingAmount)
	                ELSE 0
	            END,
	            1,
	            @CreatorId,
	            GETDATE(),
	            @CreatorId,
	            GETDATE(),
	            1,
				'PurchaseInvoiceItem',
				PurchaseInvoiceItemID
	    FROM   #TItem
	    WHERE  ISNULL(AllocationSharingAmount,0) <> 0
		and ExchangeManner = 1

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
	    	    PurchaseControlDescription,
	    	    PurchaseControlDescription2,
	            CASE 
	                WHEN AllocationSharingAmount < 0 THEN ABS(AllocationSharingAmount)
	                ELSE 0
	            END,
	            CASE 
	                WHEN AllocationSharingAmount < 0 THEN 0
	                ELSE ABS(AllocationSharingAmount)
	            END,
	    	    case when b.HasCurrency = 1 then CurrencyId else -1 end,
	    	    case when b.HasCurrency = 1 and CurrencyId <> -1 then 0 else 1 end,
				case when b.HasCurrency = 1 and CurrencyId <> -1 then 0 
					else 
						CASE 
							WHEN AllocationSharingAmount < 0 THEN ABS(AllocationSharingAmount)
							ELSE 0
						END 
					end,
				case when b.HasCurrency = 1 and CurrencyId <> -1 then 0 
					else 
						CASE 
							WHEN AllocationSharingAmount < 0 THEN 0
							ELSE ABS(AllocationSharingAmount)
						END 
					end,
	    	    1,
	    	    @CreatorId,
	    	    GETDATE(),
	    	    @CreatorId,
	    	    GETDATE(),
	    	    1,
				'PurchaseInvoiceItem',
				PurchaseInvoiceItemID
	    FROM   #TItem a
		join acc.sl b on a.Slid = b.SlID	    
		where ISNULL(AllocationSharingAmount,0)<>0
		and ExchangeManner = 2
	    -----------------------------------Deduction insert------------------
	    IF @PurchaseInvoicePrevoucherMode = 0
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
	            PayableAccountsDescription,
	            PayableAccountsDescription2,
	            DeductionInBaseCurrency,
	            0,
	            CurrencyId,
	            currencyrate,
	            Deduction,
	            0,
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
			select PurchaseInvoiceID,SUM(Deduction) Deduction,SUM(DeductionInBaseCurrency) DeductionInBaseCurrency
			from #Deduction
			group by PurchaseInvoiceID
			)a
			join #PurchaseInvoice b on a.PurchaseInvoiceID = b.PurchaseInvoiceID
	    END
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
	    SELECT  PreVoucherId,
	            1,
	            SLID,
	            DESCRIPTION,
	            DESCRIPTION,
	            0,
	            DeductionInBaseCurrency,
	            CurrencyId,
	            currencyrate,
	            0,
	            Deduction,
	            1,
	            @CreatorId,
	            GETDATE(),
	            @CreatorId,
	            GETDATE(),
	            0,
				'ConfirmStatementItem',
				ConfirmStatementItemID
	    FROM   #Deduction
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
				PayableAccountsDescription,
				PayableAccountsDescription2,
				0,
				NetInBaseCurrency + TaxInBaseCurrency + DutyInBaseCurrency -ISNULL(c.PriceInBaseCurrency, 0) -ISNULL(d.DeductionInBaseCurrency, 0)-AllocationSharingAmount,
				CurrencyId,
				currencyrate,
				0,
				Net + tax + duty -ISNULL(c.Price, 0) -ISNULL(d.Deduction, 0),
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
			select  PurchaseInvoiceID,SUM(Net) Net, SUM(tax) tax, SUM(duty) duty,
					SUM(NetInBaseCurrency) NetInBaseCurrency, SUM(TaxInBaseCurrency) TaxInBaseCurrency, SUM(DutyInBaseCurrency) DutyInBaseCurrency,
					sum(AllocationSharingAmount) AllocationSharingAmount
			from #TItem
			group by PurchaseInvoiceID
			)a
			join #PurchaseInvoice b on a.PurchaseInvoiceID = b.PurchaseInvoiceID	
			left join
			(
			select PurchaseInvoiceID,SUM(Price) Price,SUM(PriceInBaseCurrency) PriceInBaseCurrency
			from #PurchaseInvoicePrePayment
			group by PurchaseInvoiceID
			)c on c.PurchaseInvoiceID = b.PurchaseInvoiceID
			left join
			(
			select PurchaseInvoiceID,SUM(Deduction) Deduction,SUM(DeductionInBaseCurrency) DeductionInBaseCurrency
			from #Deduction
			group by PurchaseInvoiceID
			)d on d.PurchaseInvoiceID = b.PurchaseInvoiceID
			where NetInBaseCurrency + TaxInBaseCurrency + DutyInBaseCurrency -ISNULL(c.PriceInBaseCurrency, 0) -ISNULL(d.DeductionInBaseCurrency, 0)-AllocationSharingAmount <> 0        
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
	            a.DLID,
	            NULL,
	            @CreatorId,
	            GETDATE(),
	            @CreatorId,
	            GETDATE(),
	            0
	    FROM   #PurchaseInvoice a
		JOIN acc.PreVoucherItem b on a.PrevoucherID = b.PreVoucherID
		JOIN acc.dl on dl.DLID = a.DlID
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
	    FROM   #PurchaseInvoice a
		JOIN acc.PreVoucherItem b on a.PrevoucherID = b.PreVoucherID
		JOIN acc.dl on dl.DLID = a.ContractDlId
	    JOIN acc.AccountLevelSL c ON  c.SLID = b.SlID AND c.DlTypeID = dl.DlTypeID

		;with temp as 
		(
			select  [pi].PreVoucherItemID,
					ROW_NUMBER() over(partition by pi.PreVoucherID order by PreVoucherItemID) RowIndex,
					REPLACE (
						REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE([pi].Description,
						'@@DlTitle@@',i.DLTitle),
						'@@PurchaseInvocieNumber@@',isnull(i.InvoiceNumber,N'')),
						'@@PurchaseInvocieDate_Solar@@',isnull(i.InvoiceDate_PersianFullDateAlternateKey,N'')),
						'@@PurchaseInvocieDate_AD@@',isnull(i.InvoiceDate_FullDateAlternateKey,N'')),
						'@@Number@@',i.Number),
						'@@Date_Gregorian@@',FullDateAlternateKey),
						'@@Date_Solar@@',PersianFullDateAlternateKey),'@@PurchaseType@@',i.PurchaseTypeTitle1)[Description],
					REPLACE (REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE([pi].Description2,
						'@@DlTitle@@',i.DLTitle2),
						'@@PurchaseInvocieNumber@@',isnull(i.InvoiceNumber,N'')),
						'@@PurchaseInvocieDate_Solar@@',isnull(i.InvoiceDate_PersianFullDateAlternateKey,N'')),
						'@@PurchaseInvocieDate_AD@@',isnull(i.InvoiceDate_FullDateAlternateKey,N'')),
						'@@Number@@',i.Number),
						'@@Date_Gregorian@@',FullDateAlternateKey),
						'@@Date_Solar@@',PersianFullDateAlternateKey),'@@PurchaseType@@',PurchaseTypeTitle2) [Description2]
			from #PurchaseInvoice i
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
					REPLACE (REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE([pi].Description,
						'@@DlTitle@@',i.DLTitle),
						'@@PurchaseInvocieNumber@@',isnull(i.InvoiceNumber,N'')),
						'@@PurchaseInvocieDate_Solar@@',isnull(i.InvoiceDate_PersianFullDateAlternateKey,N'')),
						'@@PurchaseInvocieDate_AD@@',isnull(i.InvoiceDate_FullDateAlternateKey,N'')),
						'@@Number@@',i.Number),
						'@@Date_Gregorian@@',FullDateAlternateKey),
						'@@Date_Solar@@',PersianFullDateAlternateKey),	'@@PurchaseType@@',i.PurchaseTypeTitle1)
		,
			[Description2] =
					REPLACE (REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE([pi].Description2,
						'@@DlTitle@@',i.DLTitle2),
						'@@PurchaseInvocieNumber@@',isnull(i.InvoiceNumber,N'')),
						'@@PurchaseInvocieDate_Solar@@',isnull(i.InvoiceDate_PersianFullDateAlternateKey,N'')),
						'@@PurchaseInvocieDate_AD@@',isnull(i.InvoiceDate_FullDateAlternateKey,N'')),
						'@@Number@@',i.Number),
						'@@Date_Gregorian@@',FullDateAlternateKey),
						'@@Date_Solar@@',PersianFullDateAlternateKey),'@@PurchaseType@@',i.PurchaseTypeTitle2)
		from acc.PreVoucher pi
		join #PurchaseInvoice i on pi.PrevoucherID = i.PrevoucherID
