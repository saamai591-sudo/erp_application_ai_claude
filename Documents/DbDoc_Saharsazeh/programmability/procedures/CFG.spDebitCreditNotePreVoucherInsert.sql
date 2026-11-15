		
Create   PROCEDURE [CFG].spDebitCreditNotePreVoucherInsert
	@DebitCreditNoteId NVARCHAR(MAX)
--WITH ENCRYPTION 
	 AS 
	
	    DECLARE @DocumentNumTypeId  INT = (SELECT DocumentNumTypeID  FROM   CFG.DocumentNumType  WHERE EngName = 'DebitCreditNote'),
				@MDEntity INT = (select Top 1 Id from mdt.DmdEntity AS de where Name = 'DebitCreditNote'),
		        @HeaderDescription NVARCHAR(MAX),
				@HeaderDescription2 NVARCHAR(MAX),
	            @DebitDescription NVARCHAR(MAX),
				@DebitDescription2 NVARCHAR(MAX),
	            @CreditDescription NVARCHAR(MAX),
				@CreditDescription2 NVARCHAR(MAX),
				@BaseDigit int,
				@MaxPrevoucherID int,
				@CreatorId int
	        
		set @CreatorId = cfg.GetuserID();
		set @BaseDigit = cfg.GetBaseCurrencyPrecision();

		SELECT [value] ID
		INTO #DocumentIds
		FROM   cfg.R_FnCommaStr2Table(@DebitCreditNoteId) 	

		select  @HeaderDescription = Description,
				@HeaderDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'Header'

		select  @DebitDescription = Description,
				@DebitDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'Debit'

		select  @CreditDescription = Description,
				@CreditDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'Credit'   

		select @MaxPrevoucherID = MAX(PreVoucherID)
		from acc.PreVoucher
	    --- FetchValues ---
	    SELECT  isnull(@MaxPrevoucherID,0) + ROW_NUMBER() over(order by DCN.DebitCreditNoteID) PrevoucherID,	
				DCN.DebitCreditNoteID,
	            DCN.Number,
			    dcn.FinancialPeriodID,
			    dcn.Date,
			    dcn.BranchID,
				isnull(dcn.Description,'')  HeaderDescription,
				isnull(dcn.Description2,'') HeaderDescription2,
				replace(
				@HeaderDescription,'@@HeaderDescription@@',isnull(dcn.Description,'')) Description,
				replace(
				@HeaderDescription2,'@@HeaderDescription@@',isnull(dcn.Description2,'')) Description2,
				cast(null as varchar(max)) ErrorMessage,
				dd.FullDateAlternateKey,
				dd.PersianFullDateAlternateKey
			into #DebitCreditNote
	    FROM   CFG.DebitCreditNote DCN
		JOIN #DocumentIds b on DCN.DebitCreditNoteID = b.ID
		JOIN cfg.DimDate DD on DD.Date = DCN.Date
	    WHERE DCN.PreVoucherID is null  

	create table #TempDebitCreditNoteItem
	(
	DebitCreditNoteItemID int,
	DebitCreditNoteID int,
	PreVoucherID int,
	SlID int,
	DlID int,
	Description nvarchar(max),
	Description2 nvarchar(max),
	AmountInBaseCurrency decimal(36,10),
	Amount decimal(36,10),
	CurrencyID int,
	CurrencyRate decimal(36,10),
	[Type] tinyint,
	ContractDlID int	
	)   
	
	insert into 	#TempDebitCreditNoteItem
	select      DebitCreditNoteItemID,
				h.DebitCreditNoteID,
				h.PreVoucherID,
				case 
					 when PurchaseType.SlID is not null then PurchaseType.SlID
					 when PurchaseType2.SlID is not null then PurchaseType2.SlID
					 when SaleType.SlID is not null then SaleType.SlID
					 when SaleType2.SlID is not null then SaleType2.SlID
					 when a.PaymentTypeID is not null then b.SlID
					 when a.ReceiptTypeID is not null then c.SLID end,
				p.DlID,
				REPLACE(@DebitDescription,'@@ItemDescription@@',isnull(a.Description,'')),
				REPLACE(@DebitDescription2,'@@ItemDescription@@',isnull(a.Description2,'')),
				case when cu.IsBaseCurrencyBasis = 0
						then ROUND(a.Amount * a.CurrencyRate / cu.ExchangeUnit,@BaseDigit)
					 when cu.IsBaseCurrencyBasis = 1
						then ROUND(a.Amount * cu.ExchangeUnit / a.CurrencyRate ,@BaseDigit)
					end,
				Amount,
				a.CurrencyID,
				a.CurrencyRate,
				0,
				co.DLID
	from CFG.DebitCreditNoteItem a
	join #DebitCreditNote h on h.DebitCreditNoteID = a.DebitCreditNoteID
	join cfg.Currency cu on cu.CurrencyID = a.CurrencyID
	left join fin.PaymentType b on a.PaymentTypeID = b.PaymentTypeID
	left join fin.ReceiptType c on a.ReceiptTypeID = c.ReceiptTypeID
	left join cfg.Party p on p.PartyID = a.PartyID
	left join cnt.Contract co on co.ContractID = a.ContractID
	left join vnd.PurchaseInvoice pi on pi.PurchaseInvoiceID = a.PurchaseInvoiceID
	left join vnd.PurchaseType on PurchaseType.PurchaseTypeID = pi.Type
	left join vnd.ReturnInvoice ri on ri.ReturnInvoiceID = a.ReturnInvoiceID
	left join vnd.PurchaseType PurchaseType2 on PurchaseType2.PurchaseTypeID = ri.Type
	left join sle.ReturnedSaleInvoice on ReturnedSaleInvoice.ReturnedSaleInvoiceID = a.ReturnedSaleInvoiceID
	left join sle.SaleType on SaleType.SaleTypeID = ReturnedSaleInvoice.SaleTypeID
	left join sle.Invoice on Invoice.InvoiceID = a.InvoiceID
	left join sle.SaleType SaleType2 on SaleType2.SaleTypeID = Invoice.SaleTypeID
	where a.[Type]=0
	    	
	insert into 	#TempDebitCreditNoteItem
	select      a.DebitCreditNoteItemID,
				h.DebitCreditNoteID,
				h.PreVoucherID,
				case when a.PaymentTypeID is not null then b.SlID
					 when a.ReceiptTypeID is not null then c.SLID end,
				p.DlID,
				REPLACE(@CreditDescription,'@@ItemDescription@@',isnull(a.Description,'')),
				REPLACE(@CreditDescription2,'@@ItemDescription@@',isnull(a.Description2,'')),
				case when cu.IsBaseCurrencyBasis = 0
						then ROUND(a.Amount * a.CurrencyRate / cu.ExchangeUnit,@BaseDigit)
					 when cu.IsBaseCurrencyBasis = 1
						then ROUND(a.Amount * cu.ExchangeUnit / a.CurrencyRate ,@BaseDigit)
					end,
				a.Amount,
				a.CurrencyID,
				a.CurrencyRate,
				1,
				co.DLID
	from CFG.DebitCreditNoteItem a
	join #DebitCreditNote h on h.DebitCreditNoteID = a.DebitCreditNoteID
	join cfg.Currency cu on cu.CurrencyID = a.CurrencyID
	left join fin.PaymentType b on a.PaymentTypeID = b.PaymentTypeID
	left join fin.ReceiptType c on a.ReceiptTypeID = c.ReceiptTypeID
	left join cfg.Party p on p.PartyID = a.PartyID
	left join cnt.Contract co on co.ContractID = a.ContractID
	where a.[Type]=1

	insert into 	#TempDebitCreditNoteItem
	select      a.DebitCreditNoteItemID,
				h.DebitCreditNoteID,
				h.PreVoucherID,
				(
					select ConfigValue
					from cfg.Configuration
					where ConfigKey = case when rt.Type = 2 or pt.Type = 2 then 'SaleDiscountSlID'
										   else 'PurchaseDiscountSliD'
										   end
				),
				p.DlID,
				REPLACE(@CreditDescription,'@@ItemDescription@@',isnull(a.Description,'')),
				REPLACE(@CreditDescription2,'@@ItemDescription@@',isnull(a.Description2,'')),
				case when cu.IsBaseCurrencyBasis = 0
						then ROUND(a.Discount * a.CurrencyRate / cu.ExchangeUnit,@BaseDigit)
					 when cu.IsBaseCurrencyBasis = 1
						then ROUND(a.Discount * cu.ExchangeUnit / a.CurrencyRate ,@BaseDigit)
					end,
				a.Discount,
				a.CurrencyID,
				a.CurrencyRate,
				0,
				null
	from CFG.DebitCreditNoteItem a
	join #DebitCreditNote h on h.DebitCreditNoteID = a.DebitCreditNoteID
	join cfg.Currency cu on cu.CurrencyID = a.CurrencyID
	left join cfg.Party p on p.PartyID = a.PartyID
	left join fin.PaymentType pt on a.PaymentTypeID = pt.PaymentTypeID 
	left join fin.ReceiptType rt on a.ReceiptTypeID = rt.ReceiptTypeID 
	where a.[Type]=1	  and a.Discount > 0

	insert into 	#TempDebitCreditNoteItem
	select      a.DebitCreditNoteItemID,
				h.DebitCreditNoteID,
				h.PreVoucherID,
				(
					select ConfigValue
					from cfg.Configuration
					where ConfigKey = case when rt.Type = 2 or pt.Type = 2 then 'SaleDiscountSlID'
										   else 'PurchaseDiscountSliD'
										   end
				),
				p.DlID,
				REPLACE(@DebitDescription,'@@ItemDescription@@',isnull(a.Description,'')),
				REPLACE(@DebitDescription2,'@@ItemDescription@@',isnull(a.Description2,'')),
				case when cu.IsBaseCurrencyBasis = 0
						then ROUND(a.Discount * a.CurrencyRate / cu.ExchangeUnit,@BaseDigit)
					 when cu.IsBaseCurrencyBasis = 1
						then ROUND(a.Discount * cu.ExchangeUnit / a.CurrencyRate ,@BaseDigit)
					end,
				a.Discount,
				a.CurrencyID,
				a.CurrencyRate,
				1,
				null
	from CFG.DebitCreditNoteItem a
	join #DebitCreditNote h on h.DebitCreditNoteID = a.DebitCreditNoteID
	join cfg.Currency cu on cu.CurrencyID = a.CurrencyID
	left join cfg.Party p on p.PartyID = a.PartyID
	left join fin.PaymentType pt on a.PaymentTypeID = pt.PaymentTypeID 
	left join fin.ReceiptType rt on a.ReceiptTypeID = rt.ReceiptTypeID 
	where a.[Type]=0 and a.Discount > 0

	DECLARE @Sum DECIMAL(36,10)
	select @Sum = sum(case when type = 0 then AmountInBaseCurrency else -AmountInBaseCurrency end)
	from #TempDebitCreditNoteItem

		CREATE TABLE #Allocation
				(
				DebitCreditNoteID int,
				PrevoucherID int,
				DebitCreditNoteItemID INT,
				CurrencyID INT,
				CurrencyRate DECIMAL(36,10),
				Debit DECIMAL(36,10),
				CurrencyDebit DECIMAL(36,10),
				Credit DECIMAL(36,10),
				CurrencyCredit DECIMAL(36,10),
				SlID INT,
				DlID INT,
				Description nvarchar(max),
				Description2 nvarchar(max),
				PreVoucherItemID int,
				RowIndex int
				)

		INSERT INTO #Allocation
		SELECT 
				pr.DebitCreditNoteID,
				pr.PrevoucherID,
				ps.DebitCreditNoteItemID,
				ps.CurrencyID,
				0,
				case when ps.Allocation > 0 then ps.Allocation else 0 end,
				0,
				case when ps.Allocation > 0 then 0 else abs(ps.Allocation) end,
				0,
				case when PT.SLID is not null then PT.SLID when RT.SLID is not null then RT.SLID  end,
				p.DlID,
				N'بابت تسعیر ارز',
				N'بابت تسعیر ارز',
				null,
				ps.RowIndex
		FROM cfg.DebitCreditNoteItem  ps 
		join #DebitCreditNote pr     on pr.DebitCreditNoteID = ps.DebitCreditNoteID
		left join fin.PaymentType PT on Pt.PaymentTypeID = ps.PaymentTypeID
		left join fin.ReceiptType rt on rt.ReceiptTypeID = ps.ReceiptTypeID
		left join cfg.Party p on p.PartyID = ps.PartyID
		where ps.Allocation <> 0

		INSERT INTO #Allocation
		SELECT 
				pr.DebitCreditNoteID,
				pr.PrevoucherID,
				ps.DebitCreditNoteItemID,
				-1,
				1,
				case when ps.Allocation > 0 then 0 else abs(ps.Allocation) end,
				case when ps.Allocation > 0 then 0 else abs(ps.Allocation) end,
				case when ps.Allocation > 0 then ps.Allocation else 0 end,
				case when ps.Allocation > 0 then ps.Allocation else 0 end,
				case when PT.AllocationSlID is not null then PT.AllocationSlID when RT.AllocationSlID is not null then RT.AllocationSlID end,
				p.DlID,
				N'بابت تسعیر ارز',
				N'بابت تسعیر ارز',
				null,
				ps.RowIndex
		FROM cfg.DebitCreditNoteItem  ps 
		join #DebitCreditNote pr     on pr.DebitCreditNoteID = ps.DebitCreditNoteID
		left join fin.PaymentType PT on Pt.PaymentTypeID = ps.PaymentTypeID
		left join fin.ReceiptType rt on rt.ReceiptTypeID = ps.ReceiptTypeID
		left join cfg.Party p on p.PartyID = ps.PartyID
		where ps.Allocation <> 0

	if @Sum <> 0
	  begin

		  declare @ID int
		  select top 1 @ID = DebitCreditNoteItemID
		  from #TempDebitCreditNoteItem
		  where Type = 1

		  update  #TempDebitCreditNoteItem
		  set AmountInBaseCurrency = AmountInBaseCurrency + @Sum
		  where DebitCreditNoteItemID = @ID

	  end


		update a
		set ErrorMessage =  N'SlNotInSubject'+char(10)+char(13)
		from #DebitCreditNote a
		join #TempDebitCreditNoteItem b on a.DebitCreditNoteID = b.DebitCreditNoteID
		WHERE b.SlID IS NULL

		if exists (select * from #DebitCreditNote where ErrorMessage is not null )
		BEGIN	
			select DebitCreditNoteID,ErrorMessage from #DebitCreditNote
			RETURN;
	    END


	    -- Insert Into PreVoucher Tabel
		set identity_insert [ACC].[PreVoucher] on	
	    INSERT INTO [ACC].[PreVoucher]([PreVoucherID],[BranchID],[DocumentNumtypeID],[Date],[FinancialPeriodID],[Description],[Description2],[Creator],[CreationDate],[LastEditor],[LastEditionDate],[Version])
		SELECT [PreVoucherID],BranchID,@DocumentNumTypeId,date,FinancialPeriodID,Description,Description2,@CreatorId,getdate(),@CreatorId,getdate(),0
		from #DebitCreditNote
		set identity_insert [ACC].[PreVoucher] off
	    
	    UPDATE a
	    SET    PreVoucherID = b.PreVoucherId
		from CFG.DebitCreditNote a
		join #DebitCreditNote b on a.DebitCreditNoteID = b.DebitCreditNoteID
	
	 
	    INSERT INTO ACC.PreVoucherItem 
				(
					PreVoucherID ,
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
			DCNI.SlID,
			DCNI.Description , 
			DCNI.Description2,
			DCNI.AmountInBaseCurrency,
			0,
			DCNI.CurrencyID , 
			DCNI.CurrencyRate, 
			DCNI.Amount, 
			0,
			@CreatorId,
			GETDATE(),
			@CreatorId,
			GETDATE(),
			0		,
			'DebitCreditNoteItem',
			DebitCreditNoteItemID
	    from #TempDebitCreditNoteItem DCNI
	    where  DCNI.[type] = 0
	    
	    INSERT INTO ACC.PreVoucherItem 
				(
					PreVoucherID ,
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
			DCNI.SlID,
			DCNI.Description , 
			DCNI.Description2,
			0,
			DCNI.AmountInBaseCurrency,
			DCNI.CurrencyID , 
			DCNI.CurrencyRate, 
			0, 
			DCNI.Amount,
			@CreatorId,
			GETDATE(),
			@CreatorId,
			GETDATE(),
			0			,
			'DebitCreditNoteItem',
			DebitCreditNoteItemID
	    from #TempDebitCreditNoteItem DCNI
	    where  DCNI.[type] = 1
	    
		INSERT INTO ACC.PreVoucherItem 
				(
				PreVoucherID ,
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
				SlID,
				Description,
				Description2,
				Debit,	
				Credit,		
				CurrencyID,
				CurrencyRate,
				CurrencyDebit,	
				CurrencyCredit, 		           
				@CreatorId,
				GETDATE(),   
				@CreatorId,       
				GETDATE(),        
				0,
				'Allocation',
				DebitCreditNoteItemID
			FROM #Allocation 
			order by Debit desc

        INSERT INTO ACC.PreVoucherItemAccountLevel
        SELECT pvi.PreVoucherItemID,
               a.AccountLevelID,              
               dl.DlID,
               null,
               @CreatorId,
               GETDATE(),
               @CreatorId,
               GETDATE(),
               0
        from #TempDebitCreditNoteItem temp 
		join acc.PreVoucherItem pvi on temp.PreVoucherID = pvi.PreVoucherID and pvi.BaseDocumentName = 'DebitCreditNoteItem' and pvi.BaseDocumentID = temp.DebitCreditNoteItemID AND pvi.SlID = temp.SlID
		join acc.AccountLevelSL a on a.SlID = temp.SlID
		join acc.DL dl on dl.DLID = temp.DlID and dl.DlTypeID = a.DlTypeID

		
        INSERT INTO ACC.PreVoucherItemAccountLevel
        SELECT pvi.PreVoucherItemID,
               a.AccountLevelID,              
               dl.DlID,
               null,
               @CreatorId,
               GETDATE(),
               @CreatorId,
               GETDATE(),
               0
        from #TempDebitCreditNoteItem temp
		join acc.PreVoucherItem pvi on temp.PreVoucherID = pvi.PreVoucherID and pvi.BaseDocumentName = 'DebitCreditNoteItem' and pvi.BaseDocumentID = temp.DebitCreditNoteItemID
		join acc.AccountLevelSL a on a.SlID = temp.SlID
		join acc.DL dl on dl.DLID = temp.ContractDlID and dl.DlTypeID = a.DlTypeID

        INSERT INTO ACC.PreVoucherItemAccountLevel
        SELECT pvi.PreVoucherItemID,
               a.AccountLevelID,              
               dl.DlID,
               null,
               @CreatorId,
               GETDATE(),
               @CreatorId,
               GETDATE(),
               0
        from #Allocation temp
		join acc.PreVoucherItem pvi on temp.PreVoucherID = pvi.PreVoucherID 
									and pvi.BaseDocumentName = 'Allocation' 
									and pvi.BaseDocumentID = temp.DebitCreditNoteItemID
									and temp.debit = pvi.Debit 
									and temp.Credit = pvi.Credit
									and temp.SlID = pvi.SlID
		join acc.AccountLevelSL a on a.SlID = temp.SlID
		join acc.DL dl on dl.DLID = temp.DlID and dl.DlTypeID = a.DlTypeID
		
		;with temp as 
		(
			select  [pi].PreVoucherItemID,
					ROW_NUMBER() over(partition by pi.PreVoucherID order by pi.PreVoucherItemID) RowIndex,
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE([pi].Description,
						'@@HeaderDescription@@',i.HeaderDescription),
						'@@Number@@',i.Number),
						'@@Date_Gregorian@@',i.FullDateAlternateKey),
						'@@Date_Solar@@',i.PersianFullDateAlternateKey) [Description],
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE([pi].Description2,
						'@@HeaderDescription@@',i.HeaderDescription2),
						'@@Number@@',i.Number),
						'@@Date_Gregorian@@',i.FullDateAlternateKey),
						'@@Date_Solar@@',i.PersianFullDateAlternateKey)[Description2]
			from #DebitCreditNote i
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
					REPLACE(a.Description,
						'@@Number@@',b.Number),
						'@@Date_Gregorian@@',b.FullDateAlternateKey),
						'@@Date_Solar@@',b.PersianFullDateAlternateKey)		,
			[Description2] =
					REPLACE(
					REPLACE(
					REPLACE(a.Description2,
						'@@Number@@',b.Number),
						'@@Date_Gregorian@@',b.FullDateAlternateKey),
						'@@Date_Solar@@',b.PersianFullDateAlternateKey)			
		from acc.PreVoucher a
		join #DebitCreditNote b on a.PrevoucherID = b.PrevoucherID
