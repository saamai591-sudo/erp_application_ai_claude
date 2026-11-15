CREATE   PROCEDURE [FOS].spRegistrationPreVoucherInsert
	@RegistrationID NVARCHAR(MAX)
--WITH ENCRYPTION
AS
	DECLARE @DocumentNumTypeId  INT = (SELECT DocumentNumTypeID  
	                                    FROM   CFG.DocumentNumType  
	                                    WHERE EngName = 'Registration'),
	        @MDEntity INT = (select Top 1 Id from mdt.DmdEntity AS de where Name = 'Registration'),
		    @HeaderDescription NVARCHAR(MAX),
			@HeaderDescription2 NVARCHAR(MAX),
	        @PayableAccountsDescription NVARCHAR(MAX),
			@PayableAccountsDescription2 NVARCHAR(MAX),
	        @CostDescription NVARCHAR(MAX),
			@CostDescription2 NVARCHAR(MAX),
			@MaxPrevoucherID int,
			@CreatorId int,
			@Culture VARCHAR(10),
			@CultureNo TinyInt,
			@PayableAccountSl  INT ,          
	        @RegistrationSl    INT   
	        
		set @CreatorId = cfg.GetuserID();
		SET @Culture = CFG.GetuserCulture();

		select @CultureNo = CultureNo
		from cfg.CultureInfo
		where Culture = @Culture;

		SELECT [value] ID
		INTO #DocumentIds
		FROM   cfg.R_FnCommaStr2Table(@RegistrationID) 	


		select  @HeaderDescription = Description,
				@HeaderDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'Header'

		select  @PayableAccountsDescription = Description,
				@PayableAccountsDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'PayableAccounts'

		select  @CostDescription = Description,
				@CostDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'Cost'   

		select @MaxPrevoucherID = MAX(PreVoucherID)
		from acc.PreVoucher
	    --- FetchValues ---
	    SELECT  isnull(@MaxPrevoucherID,0) + ROW_NUMBER() over(order by RegistrationID) PrevoucherID,	
				RegistrationID,
				r.branchid,
				r.FinancialPeriodID,
				r.Date,
				cast(null as varchar(max)) ErrorMessage,
				@HeaderDescription Description,
				@HeaderDescription2 Description2,
				R.RegistrationNumber,
				WageAmount,
				p.DLID,
				dd.FullDateAlternateKey,
				dd.PersianFullDateAlternateKey,
				pa.DlID PartyDlId
			into #Registration
		from fos.Registration r
		JOIN fos.ProformaInvoice p on p.ProformaInvoiceID = r.ProformaInvoiceID
		LEFT JOIN cfg.Party pa on r.PartyID = pa.PartyID
		JOIN #DocumentIds b on r.RegistrationID = b.ID
		JOIN cfg.DimDate DD on DD.Date = r.Date
	    WHERE r.PreVoucherID is null   

		SELECT @PayableAccountSl = ConfigValue
		FROM  cfg.Configuration 
		where ConfigKey = 'PaymentsAccountId'

		update a
		set ErrorMessage =  'معین حسابهای پرداختنی در تنظیمات عمومی مشخص نشده است.' + char(10)+char(13)
		from #Registration a
		WHERE @PayableAccountSl is null

		update a
		set ErrorMessage =  'نهاد ثبت کننده خالی است.' + char(10)+char(13)
		from #Registration a
		WHERE  a.PartyDlId is null

		select @RegistrationSl = slid 
		from fos.specialcost
		where code = 100

		update a
		set ErrorMessage = ISNULL(ErrorMessage,'') +  'معین خرید خدمت ثبت انتخاب شده مشخص نشده است.' + char(10)+char(13)
		from #Registration a
		WHERE @RegistrationSl is null
	
		if exists (select * from #Registration where ErrorMessage is not null )
		BEGIN	
			select RegistrationID,ErrorMessage from #Registration
			RETURN;
	    END

	    -- Insert Into PreVoucher Tabel
		set identity_insert [ACC].[PreVoucher] on	
	    INSERT INTO [ACC].[PreVoucher](PreVoucherID,[BranchID],[DocumentNumtypeID],[Date],[FinancialPeriodID],[Description],[Description2],[Creator],[CreationDate],[LastEditor],[LastEditionDate],[Version])
		SELECT PreVoucherID,BranchId, @DocumentNumTypeId,date,FinancialPeriodID,Description,Description2,@CreatorId,GETDATE(),@CreatorId,GETDATE(),0
		from #Registration
		set identity_insert [ACC].[PreVoucher] off
	    
	    UPDATE a
	    SET    PreVoucherID = b.PreVoucherId
		from fos.Registration a
		join #Registration b on a.RegistrationID = b.RegistrationID
	    

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
			@RegistrationSl,			
			@CostDescription,
			@CostDescription2, 
			WageAmount,
			0,     
			-1,
			1,
			WageAmount,
			0,            
			@CreatorId,
			GETDATE(),   
			@CreatorId,       
			GETDATE(),        
			0,
			'Registration',
			RegistrationID
		from #Registration

	     
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
			2,
			@PayableAccountSl,			
			@PayableAccountsDescription,
			@PayableAccountsDescription2, 
			0,
			WageAmount,
			-1,
			1,
			0,
			WageAmount,            
			@CreatorId,
			GETDATE(),   
			@CreatorId,       
			GETDATE(),        
			0,
			'Registration',
			RegistrationID
		from #Registration

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
			dl.DLID,
			NULL,
			@CreatorId,
			GETDATE(),
			@CreatorId,
			GETDATE(),
			0		
	    FROM #Registration a
		join acc.PreVoucherItem pvi on pvi.BaseDocumentName = 'Registration' and pvi.BaseDocumentID = a.RegistrationID
		join acc.AccountLevelSL al on al.SlID = pvi.SlID
		join acc.dl on dl.DLID = a.DLID and al.DlTypeID = dl.DlTypeID
	     

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
			dl.DLID,
			NULL,
			@CreatorId,
			GETDATE(),
			@CreatorId,
			GETDATE(),
			0		
	    FROM #Registration a
		join acc.PreVoucherItem pvi on pvi.BaseDocumentName = 'Registration' and pvi.BaseDocumentID = a.RegistrationID
		join acc.AccountLevelSL al on al.SlID = pvi.SlID 
		join acc.dl on dl.DLID = a.PartyDlId and al.DlTypeID = dl.DlTypeID
		
		;with temp as 
		(
			select  [pi].PreVoucherItemID,
					ROW_NUMBER() over(partition by pi.PreVoucherID order by PreVoucherItemID) RowIndex,
					REPLACE(
					REPLACE(
					REPLACE(
						[pi].Description,
						'@@Number@@',i.RegistrationNumber),
						'@@Date_Gregorian@@',FullDateAlternateKey),
						'@@Date_Solar@@',PersianFullDateAlternateKey) [Description],
					REPLACE(
					REPLACE(
					REPLACE(
						[pi].Description2,
						'@@Number@@',i.RegistrationNumber),
						'@@Date_Gregorian@@',FullDateAlternateKey),
						'@@Date_Solar@@',PersianFullDateAlternateKey)[Description2]
			from #Registration i
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
						[pi].Description,
						'@@Number@@',i.RegistrationNumber),
						'@@Date_Gregorian@@',FullDateAlternateKey),
						'@@Date_Solar@@',PersianFullDateAlternateKey)		
		,
			[Description2] =
					REPLACE(
					REPLACE(
					REPLACE(
						[pi].Description2,
						'@@Number@@',i.RegistrationNumber),
						'@@Date_Gregorian@@',FullDateAlternateKey),
						'@@Date_Solar@@',PersianFullDateAlternateKey)
		from acc.PreVoucher pi
		join #Registration i on pi.PrevoucherID = i.PrevoucherID

--------------------------------------------------------------------------------------------------------
