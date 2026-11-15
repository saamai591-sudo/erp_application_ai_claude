
------------------------------------- END #7021

------------------------------------- START RAScript20
create   PROCEDURE [FIN].spPaymentCheqeFlowPreVoucherInsert

	@PaymentCheqeFlowId NVARCHAR(MAX)
--WITH ENCRYPTION
AS

	    DECLARE @DocumentNumTypeId  INT = (SELECT DocumentNumTypeID FROM  CFG.DocumentNumType WHERE EngName = 'PaymentCheqeFlow'),
				@MDEntityDrawBackPaymentCheqe INT = (select Top 1 Id from mdt.DmdEntity AS de where Name = 'DrawBackPaymentCheqe'),
				@MDEntityPaymentCheqeCashing INT = (select Top 1 Id from mdt.DmdEntity AS de where Name = 'PaymentCheqeCashing'),
				@MaxPrevoucherID int,
				@CreatorId int,
	            @HeaderDescriptionDrawBackPaymentCheqe NVARCHAR(MAX) ,
	            @HeaderDescriptionDrawBackPaymentCheqe2 NVARCHAR(MAX) ,
	            @HeaderDescriptionPaymentCheqeCashing NVARCHAR(MAX) ,
	            @HeaderDescriptionPaymentCheqeCashing2 NVARCHAR(MAX) ,
	            @PayableDocumentsDescriptionDrawBackPaymentCheqe NVARCHAR(MAX) ,
	            @PayableDocumentsDescriptionDrawBackPaymentCheqe2 NVARCHAR(MAX) ,
	            @PayableDocumentsDescriptionPaymentCheqeCashing NVARCHAR(MAX) ,
	            @PayableDocumentsDescriptionPaymentCheqeCashing2 NVARCHAR(MAX) ,
	            @BankDescription NVARCHAR(MAX) ,
	            @BankDescription2 NVARCHAR(MAX) ,
	            @PayableAccountsDescription NVARCHAR(MAX) ,
	            @PayableAccountsDescription2 NVARCHAR(MAX) ,
	            @CurrencyId    INT,
				@Culture VARCHAR(10),
				@BaseDigit INT,
				@CultureNo tinyint


		
		set @BaseDigit = cfg.GetBaseCurrencyPrecision();
		set @CreatorId = cfg.GetuserID();
		set @Culture = cfg.GetuserCulture();
		
		select @CultureNo = CultureNo
		from cfg.CultureInfo
		where Culture = @Culture

		SELECT [value] ID
		INTO #DocumentIds
		FROM   cfg.R_FnCommaStr2Table(@PaymentCheqeFlowId) 	

		select  @HeaderDescriptionDrawBackPaymentCheqe = Description,
				@HeaderDescriptionDrawBackPaymentCheqe2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntityDrawBackPaymentCheqe and [Key] = 'Header'

		select  @HeaderDescriptionPaymentCheqeCashing = Description,
				@HeaderDescriptionPaymentCheqeCashing2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntityPaymentCheqeCashing and [Key] = 'Header'

		select  @PayableDocumentsDescriptionDrawBackPaymentCheqe = Description,
				@PayableDocumentsDescriptionDrawBackPaymentCheqe2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntityDrawBackPaymentCheqe and [Key] = 'PayableDocuments'

		select  @PayableDocumentsDescriptionPaymentCheqeCashing = Description,
				@PayableDocumentsDescriptionPaymentCheqeCashing2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntityPaymentCheqeCashing and [Key] = 'PayableDocuments'

		select  @PayableAccountsDescription = Description,
				@PayableAccountsDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntityDrawBackPaymentCheqe and [Key] = 'PayableAccounts'

		select  @BankDescription = Description,
				@BankDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntityPaymentCheqeCashing and [Key] = 'Bank'



		select @MaxPrevoucherID = MAX(PreVoucherID)
		from acc.PreVoucher
	    --- FetchValues ---
	    SELECT  isnull(@MaxPrevoucherID,0) + ROW_NUMBER() over(order by rr.PaymentCheqeFlowID) PrevoucherID,	
				PaymentCheqeFlowID,
				rr.BranchID,
				rr.FinancialPeriodID,
				rr.[Type],
				rr.PartyID,
				rr.BankAccountID,						           
				rr.date,
				cast(null as varchar(max)) ErrorMessage ,
				DD.FullDateAlternateKey,
				DD.PersianFullDateAlternateKey,	
				case when rr.Type = 0 then @HeaderDescriptionPaymentCheqeCashing
					 when rr.Type = 1 then @HeaderDescriptionDrawBackPaymentCheqe
					end  Description,	
				case when rr.Type = 0 then @HeaderDescriptionPaymentCheqeCashing2
					 when rr.Type = 1 then @HeaderDescriptionDrawBackPaymentCheqe2
					end  Description2,	
				rr.InnerNumber Number
			into #PaymentCheqeFlow
	    FROM   FIN.PaymentCheqeFlow rr 
		JOIN #DocumentIds b on rr.PaymentCheqeFlowID = b.ID
		JOIN cfg.DimDate DD on DD.Date = rr.Date
	    WHERE rr.PreVoucherID is null  

		SELECT  h.PaymentCheqeFlowID,
				h.PrevoucherID,
				PaymentCheqeFlowItemID,
				rc.CurrencyID,
				rc.CurrencyRate,
				rc.Amount,
				case when c.IsBaseCurrencyBasis = 0
					then ROUND(rc.Amount * Rc.CurrencyRate / c.exchangeunit , @BaseDigit) 
					 when c.IsBaseCurrencyBasis = 1
					then ROUND(rc.Amount * exchangeunit / Rc.CurrencyRate  , @BaseDigit) 
					end AmountInBaseCurrency,
				rct.SlID,
				p.DlID PartyDlID,
				ba.DlID BankAccountDlID,
				ba.SLID BankAccountSlID,
				rc.PaymentCheqeID,
				h.Type,
				REPLACE(
				REPLACE(
				REPLACE(
				REPLACE(
				case when h.Type = 0 then @PayableDocumentsDescriptionPaymentCheqeCashing
					 when h.type = 1 then @PayableDocumentsDescriptionDrawBackPaymentCheqe
					 end
				,'@@PartyTitle@@',p.Title+isnull(p.lastname,''))	
				,'@@CheckDueDate_AD@@',DD.FullDateAlternateKey)			
				,'@@CheckDueDate_Solar@@',DD.PersianFullDateAlternateKey)
				,'@@CheckNumber@@',rc.Number) PayableDocumentsDescription,
				REPLACE(
				REPLACE(
				REPLACE(
				REPLACE(
				case when h.Type = 0 then @PayableDocumentsDescriptionPaymentCheqeCashing2
					 when h.type = 1 then @PayableDocumentsDescriptionDrawBackPaymentCheqe2
					 end				
				,'@@PartyTitle@@',p.Title2+isnull(p.lastname2,''))	
				,'@@CheckDueDate_AD@@',DD.FullDateAlternateKey)			
				,'@@CheckDueDate_Solar@@',DD.PersianFullDateAlternateKey)
				,'@@CheckNumber@@',rc.Number) PayableDocumentsDescription2,
				REPLACE(
				REPLACE(
				REPLACE(
				REPLACE(
				@BankDescription
				,'@@PartyTitle@@',p.Title+isnull(p.lastname,''))	
				,'@@CheckDueDate_AD@@',DD.FullDateAlternateKey)			
				,'@@CheckDueDate_Solar@@',DD.PersianFullDateAlternateKey)
				,'@@CheckNumber@@',rc.Number) BankDescription,
				REPLACE(
				REPLACE(
				REPLACE(
				REPLACE(
				@BankDescription2			
				,'@@PartyTitle@@',p.Title2+isnull(p.lastname2,''))	
				,'@@CheckDueDate_AD@@',DD.FullDateAlternateKey)			
				,'@@CheckDueDate_Solar@@',DD.PersianFullDateAlternateKey)
				,'@@CheckNumber@@',rc.Number) BankDescription2,
				REPLACE(
				REPLACE(
				REPLACE(
				REPLACE(
				@PayableAccountsDescription
				,'@@PartyTitle@@',p.Title+isnull(p.lastname,''))	
				,'@@CheckDueDate_AD@@',DD.FullDateAlternateKey)			
				,'@@CheckDueDate_Solar@@',DD.PersianFullDateAlternateKey)
				,'@@CheckNumber@@',rc.Number) PayableAccountsDescription,
				REPLACE(
				REPLACE(
				REPLACE(
				REPLACE(
				@PayableAccountsDescription2			
				,'@@PartyTitle@@',p.Title2+isnull(p.lastname2,''))	
				,'@@CheckDueDate_AD@@',DD.FullDateAlternateKey)			
				,'@@CheckDueDate_Solar@@',DD.PersianFullDateAlternateKey)
				,'@@CheckNumber@@',rc.Number) PayableAccountsDescription2

			into #DocItems
		  FROM FIN.PaymentCheqeFlowItem rcfi 
		  join #PaymentCheqeFlow h on h.PaymentCheqeFlowID = rcfi.PaymentCheqeFlowID
		  JOIN FIN.PaymentCheqe rc ON rc.PaymentCheqeID = rcfi.PaymentCheqeID
		  join CFG.DimDate DD on DD.Date = rc.Date
		  JOIN FIN.PaymentReceipt rr ON rr.PaymentReceiptID = rc.PaymentReceiptID
		  JOIN cfg.Party p ON p.PartyID = rr.PartyID
		  JOIN cfg.BankAccount ba ON ba.BankAccountID = rc.BankAccountID
		  JOIN FIN.PaymentCheqeType rct ON rct.PaymentCheqeTypeID = rc.PaymentCheqeTypeID
		  JOIN cfg.Currency AS c ON c.CurrencyID = rc.CurrencyID

		declare @OtherPaymentsAccountId int

		select @OtherPaymentsAccountId = ConfigValue
		from cfg.Configuration
		where ConfigKey = 'OtherPaymentsAccountId'

			SELECT  di.PrevoucherID,
					di.PaymentCheqeFlowItemID,
					case when Depreciated.PaymentSubjectID is null then PT.slid else @OtherPaymentsAccountId end slid,
					ps.DLID,
					case when c.IsBaseCurrencyBasis = 0
					then ROUND(ps.Amount * ps.CurrencyRate / c.exchangeunit , @BaseDigit)
							when c.IsBaseCurrencyBasis = 1
					then ROUND(ps.Amount * c.exchangeunit  / ps.CurrencyRate , @BaseDigit)
					end AmountInBaseCurrency,
					ps.Amount,
					PayableAccountsDescription Description,
					PayableAccountsDescription2 Description2,
					Depreciated.PaymentSubjectID ,
					di.PaymentCheqeFlowID,
					case when @CultureNo = 1 then pt.Title else pt.Title2 end PaymentType
				INTO #Subject
			FROM #DocItems di	    
			left join fin.PaymentSubject ps on ps.PaymentCheqeID = di.PaymentCheqeID
			left join fin.PaymentType PT on PT.PaymentTypeID = ps.PaymentTypeID
			LEFT JOIN cfg.Currency AS c ON c.CurrencyID = ps.CurrencyID
			left join (
					select PaymentSubjectID
					from (
						select PaymentSubjectID
						from VND.PurchaseInvoicePrePayment
						union all
						select PaymentSubjectID
						from CFG.DebitCreditNoteItem
						union all
						select PaymentSubjectID
						from cnt.ConfirmStatementPrePayment
						)a
					group by PaymentSubjectID
						)Depreciated on Depreciated.PaymentSubjectID = ps.PaymentSubjectID	
			where di.Type = 1

		update #PaymentCheqeFlow
		set ErrorMessage = isnull(ErrorMessage,'') + N'در نوع پرداخت '+PaymentType+N' حساب معین مشخص نشده است.'+char(10)+char(13)
		from #PaymentCheqeFlow a
		join #Subject b on a.PaymentCheqeFlowID = b.PaymentCheqeFlowID
		where  b.PaymentSubjectID is null and slid is null

		update #PaymentCheqeFlow
		set ErrorMessage = isnull(ErrorMessage,'') + N'در تنظیمات عمومی، مقدار حساب معین سایر حسابهای پرداختنی مشخص نشده است'+char(10)+char(13)
		from #PaymentCheqeFlow a
		join #Subject b on a.PaymentCheqeFlowID = b.PaymentCheqeFlowID
		where  b.PaymentSubjectID is not null and slid is null

		if exists (select * from #PaymentCheqeFlow where ErrorMessage is not null )
		BEGIN	
			select PaymentCheqeFlowID,ErrorMessage from #PaymentCheqeFlow
			RETURN;
	    END

		-- Insert Into PreVoucher Tabel
		set identity_insert [ACC].[PreVoucher] on	
	    INSERT INTO [ACC].[PreVoucher]([PreVoucherID],BranchID,[DocumentNumtypeID],[Date],[FinancialPeriodID],[Description],[Description2],[Creator],[CreationDate],[LastEditor],[LastEditionDate],[Version])
		SELECT [PreVoucherID],BranchId,@DocumentNumTypeId,date,FinancialPeriodID,Description,Description2,@CreatorId,GETDATE(),@CreatorId,GETDATE(),0
		from #PaymentCheqeFlow
		set identity_insert [ACC].[PreVoucher] off
	    
	    UPDATE a
	    SET    PreVoucherID = b.PreVoucherId
		from FIN.PaymentCheqeFlow a
		join #PaymentCheqeFlow b on a.PaymentCheqeFlowID = b.PaymentCheqeFlowID

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
			di.SlID,			
			PayableDocumentsDescription,
			PayableDocumentsDescription2, 
			di.AmountInBaseCurrency,
			0,     
			di.CurrencyId,
			di.CurrencyRate,
			di.Amount,
			0,            
			@CreatorId,
			GETDATE(),   
			@CreatorId,       
			GETDATE(),        
			0,
			'PaymentCheqeFlowItem',
			PaymentCheqeFlowItemID
	    FROM #DocItems di
		
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
			di.BankAccountSlID,
			BankDescription,
			BankDescription2, 
			0, 
			di.AmountInBaseCurrency,
			    
			di.CurrencyId,
			di.CurrencyRate,
			0, 
			di.Amount,
			           
			@CreatorId,
			GETDATE(),   
			@CreatorId,       
			GETDATE(),        
			0,
			'PaymentCheqeFlowItem',
			PaymentCheqeFlowItemID
	    FROM #DocItems di	    
		where Type = 0

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
			slid,
			Description,
			Description2, 
			0, 
			AmountInBaseCurrency,
			    
			-1,
			1,
			0, 
			AmountInBaseCurrency,
			           
			@CreatorId,
			GETDATE(),   
			@CreatorId,       
			GETDATE(),        
			0,
			'PaymentCheqeFlowItem',
			PaymentCheqeFlowItemID
	    FROM #Subject

		INSERT INTO [ACC].[PreVoucherItemAccountLevel]
           ([PreVoucherItemID]
           ,[AccountLevelID]
           ,[DlID]
           ,[Value]
           ,[Creator]
           ,[CreationDate]
           ,[LastEditor]
           ,[LastEditionDate]
           ,[Version])
	    SELECT	
			pvi.PreVoucherItemID,
			al.AccountLevelID,
			#DocItems.PartyDlID,
			NULL,
			@CreatorId,
			GETDATE(),
			@CreatorId,
			GETDATE(),
			0		
	    FROM #DocItems
		join acc.PreVoucherItem pvi on pvi.BaseDocumentName = 'PaymentCheqeFlowItem' and pvi.BaseDocumentID = #DocItems.PaymentCheqeFlowItemID and pvi.SlID = #DocItems.SlID
	    JOIN acc.AccountLevelSL al ON al.SlID = pvi.SlID 
		join acc.dl on dl.DLID = PartyDlID AND al.DlTypeID = dl.DlTypeID
		left join acc.PreVoucherItemAccountLevel alvi on alvi.PreVoucherItemID = pvi.PreVoucherItemID and alvi.AccountLevelID = al.AccountLevelID
		where alvi.PreVoucherItemID is null 

		INSERT INTO [ACC].[PreVoucherItemAccountLevel]
           ([PreVoucherItemID]
           ,[AccountLevelID]
           ,[DlID]
           ,[Value]
           ,[Creator]
           ,[CreationDate]
           ,[LastEditor]
           ,[LastEditionDate]
           ,[Version])
	    SELECT	
			pvi.PreVoucherItemID,
			al.AccountLevelID,
			#DocItems.BankAccountDlID,
			NULL,
			@CreatorId,
			GETDATE(),
			@CreatorId,
			GETDATE(),
			0		
	    FROM #DocItems
		join acc.PreVoucherItem pvi on pvi.BaseDocumentName = 'PaymentCheqeFlowItem' and pvi.BaseDocumentID = PaymentCheqeFlowItemID
	    JOIN acc.AccountLevelSL al ON al.SlID = pvi.SlID 
		join acc.dl on dl.DLID = BankAccountDlID AND al.DlTypeID = dl.DlTypeID
		left join acc.PreVoucherItemAccountLevel alvi on alvi.PreVoucherItemID = pvi.PreVoucherItemID and alvi.AccountLevelID = al.AccountLevelID
		where alvi.PreVoucherItemID is null

		INSERT INTO [ACC].[PreVoucherItemAccountLevel]
           ([PreVoucherItemID]
           ,[AccountLevelID]
           ,[DlID]
           ,[Value]
           ,[Creator]
           ,[CreationDate]
           ,[LastEditor]
           ,[LastEditionDate]
           ,[Version])
	    SELECT	
			pvi.PreVoucherItemID,
			al.AccountLevelID,
			#Subject.DlID,
			NULL,
			@CreatorId,
			GETDATE(),
			@CreatorId,
			GETDATE(),
			0		
	    FROM #Subject
		join acc.PreVoucherItem pvi on pvi.BaseDocumentName = 'PaymentCheqeFlowItem' and pvi.BaseDocumentID = PaymentCheqeFlowItemID and pvi.SlID = #Subject.slid
	    JOIN acc.AccountLevelSL al ON al.SlID = pvi.SlID 
		join acc.dl on dl.DLID = #Subject.DlID AND al.DlTypeID = dl.DlTypeID
		left join acc.PreVoucherItemAccountLevel alvi on alvi.PreVoucherItemID = pvi.PreVoucherItemID and alvi.AccountLevelID = al.AccountLevelID
		where alvi.PreVoucherItemID is null
		group by pvi.PreVoucherItemID,
				 al.AccountLevelID,
				#Subject.DlID
			
		;with temp as 
		(
			select  [pi].PreVoucherItemID,
					ROW_NUMBER() over(partition by pi.PreVoucherID order by PreVoucherItemID) RowIndex,
					REPLACE(
					REPLACE(
					REPLACE([pi].Description,
						'@@Number@@',i.Number),
						'@@Date_Gregorian@@',FullDateAlternateKey),
						'@@Date_Solar@@',PersianFullDateAlternateKey) [Description],
					REPLACE(
					REPLACE(
					REPLACE([pi].Description2,
						'@@Number@@',i.Number),
						'@@Date_Gregorian@@',FullDateAlternateKey),
						'@@Date_Solar@@',PersianFullDateAlternateKey)[Description2]
			from #PaymentCheqeFlow i
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
					REPLACE([pi].Description,
						'@@Number@@',i.Number),
						'@@Date_Gregorian@@',FullDateAlternateKey),
						'@@Date_Solar@@',PersianFullDateAlternateKey)		
		,
			[Description2] =
					REPLACE(
					REPLACE(
					REPLACE([pi].Description2,
						'@@Number@@',i.Number),
						'@@Date_Gregorian@@',FullDateAlternateKey),
						'@@Date_Solar@@',PersianFullDateAlternateKey)
		from acc.PreVoucher pi
		join #PaymentCheqeFlow i on pi.PrevoucherID = i.PrevoucherID
