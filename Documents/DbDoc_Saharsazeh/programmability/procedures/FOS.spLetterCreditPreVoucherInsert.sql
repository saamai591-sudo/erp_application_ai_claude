
---------------------------------------------------------------------
Create   PROCEDURE [FOS].[spLetterCreditPreVoucherInsert]
	@LetterCreditID NVARCHAR(MAX)
--WITH ENCRYPTION
AS
	    DECLARE @DocumentNumTypeId  INT = (SELECT DocumentNumTypeID  
	                                       FROM   CFG.DocumentNumType  
	                                       WHERE EngName = 'LetterCredit'),
	            @PayableProfitSl  INT ,          
				@PayableAccountSl  INT , 
	            @Description NVARCHAR(MAX),
	            @ProfitSl    INT,      
	            @FinancialPeriod INT,
	            @BranchId     INT,
	            @maxPVItemId INT,
				@Date date,
				@Amount decimal(30,4),
				@BasePrecision int,
				@ProformaDLID int,
				@dltypeid int,
				@LetterCreditNumber varchar(250),
				@BankID int,
				@MaxPrevoucherID int,
				@CreatorId int

		set @CreatorId = cfg.GetuserID();
		set @BasePrecision = cfg.GetBaseCurrencyPrecision();

		SELECT [value] ID
		INTO #DocumentIds
		FROM   cfg.R_FnCommaStr2Table(@LetterCreditID) 	


		SELECT @PayableAccountSl = ConfigValue
		FROM  cfg.Configuration 
		where ConfigKey = 'PaymentsAccountId'

		select @MaxPrevoucherID = MAX(PreVoucherID)
		from acc.PreVoucher
	    --- FetchValues ---
	    SELECT  isnull(@MaxPrevoucherID,0) + ROW_NUMBER() over(order by LetterCreditID) PrevoucherID,	
				LetterCreditID,
				r.branchid,
				r.FinancialPeriodID,
				r.Date,
				N'بابت اعتبارات اسنادی به شماره ' + R.LetterCreditNumber + N' در تاریخ '+cfg.GetCLRSaturnDate(r.Date,'YY/MM/DD',0,0) Description,
			    R.ProfitAmount ,
				p.DLID ProformaDLID,
				s.ProfitSl,
				cast(null as varchar(max)) ErrorMessage,
				s.PaymentableProfitSl,
				LetterCreditNumber,
				pa.DlID BankDlID
			into #LetterCredit
		from fos.[LetterCredit] r
		join fos.ProformaInvoice p on p.ProformaInvoiceID = r.ProformaInvoiceID
		join fos.LetterCreditType s on s.LetterCreditTypeID = r.LetterCreditTypeID
		join cfg.Party pa on pa.PartyID = r.OpeningCreditBank
		JOIN #DocumentIds b on r.LetterCreditID = b.ID


		SELECT 
			row_number() over(order by LetterCreditBankCostid) ID,
			row_number() over(order by LetterCreditBankCostid) Rno,
			CostSlID,
			Amount,
			a.Description,
			a.LetterCreditID,
			b.PrevoucherID,
			a.LetterCreditBankCostID
		  into #LetterCreditBankCost
		from fos.LetterCreditBankCost a
		join #LetterCredit b on a.LetterCreditID = b.LetterCreditID
		
		update a
		set ErrorMessage =  'ForeignOrder.Messages.PaymentableProfitSlIsNull^'+ LetterCreditNumber 
		from #LetterCredit a		
		WHERE PaymentableProfitSl is null

		update a		
		set ErrorMessage =  'ForeignOrder.Messages.ProfitSlIsNull^'+ LetterCreditNumber 
		from #LetterCredit a		
		WHERE ProfitSl is null

		update a
		set ErrorMessage =  'اعتبار اسنادی شماره '+ LetterCreditNumber + ' فاقد هزینه های بانکی یا هزینه بهره می‌باشد. بنابراین فاقد سند حسابداری است.' + char(10)+char(13)
		from #LetterCredit a
		left join #LetterCreditBankCost b on a.LetterCreditID = b.LetterCreditID
		WHERE ProfitAmount = 0 and b.LetterCreditID is null

		if exists (select * from #LetterCredit where ErrorMessage is not null )
		BEGIN	
			select LetterCreditID,ErrorMessage from #LetterCredit
			RETURN;
	    END


	    -- Insert Into PreVoucher Tabel
		set identity_insert [ACC].[PreVoucher] on	
	    INSERT INTO [ACC].[PreVoucher](PreVoucherID,[BranchID],[DocumentNumtypeID],[Date],[FinancialPeriodID],[Description],[Description2],[Creator],[CreationDate],[LastEditor],[LastEditionDate],[Version])
		SELECT PreVoucherID,BranchId, @DocumentNumTypeId,date,FinancialPeriodID,Description,Description,@CreatorId,GETDATE(),@CreatorId,GETDATE(),0
		from #LetterCredit
		set identity_insert [ACC].[PreVoucher] off
	    
	    UPDATE a
	    SET    PreVoucherID = b.PreVoucherId
		from fos.LetterCredit a
		join #LetterCredit b on a.LetterCreditID = b.LetterCreditID

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
			ProfitSl,			
			Description,
			Description, 
			ProfitAmount,
			0,     
			-1,
			1,
			ProfitAmount,
			0,            
			@CreatorId,
			GETDATE(),   
			@CreatorId,       
			GETDATE(),        
			0,
			'LetterCredit',
			LetterCreditID
		from #LetterCredit where ProfitAmount > 0

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
			PaymentableProfitSl,			
			Description,
			Description, 
			0,
			ProfitAmount,
			-1,
			1,
			0,
			ProfitAmount,            
			@CreatorId,
			GETDATE(),   
			@CreatorId,       
			GETDATE(),        
			0,
			'LetterCredit',
			LetterCreditID
		from #LetterCredit where ProfitAmount > 0

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
			CostSlID,			
			isnull(Description , 'بابت هزینه'),
			isnull(Description , 'بابت هزینه'), 
			Amount ,
			0,     
			-1,
			1,
			amount,
			0,            
			@CreatorId,
			GETDATE(),   
			@CreatorId,       
			GETDATE(),        
			0,
			'LetterCreditBankCost',
			LetterCreditBankCostID
		from #LetterCreditBankCost

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
			Version)
	    SELECT	
			PreVoucherId,
			1,
			@PayableAccountSl,			
			Description,
			Description, 
			0,
			b.Amount,     
			-1,
			1,
			0,
			b.Amount,            
			@CreatorId,
			GETDATE(),   
			@CreatorId,       
			GETDATE(),        
			0
		from #LetterCredit a
		join
		(select LetterCreditID, sum(Amount) Amount
		from #LetterCreditBankCost
		group by LetterCreditID
		) b
			on a.LetterCreditID = b.LetterCreditID

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
			PreVoucherItemID,
			al.AccountLevelID,
			dl.DLID,
			NULL,
			@CreatorId,
			GETDATE(),
			@CreatorId,
			GETDATE(),
			0		
	    FROM #LetterCredit a
		join acc.PreVoucherItem pvi on a.PrevoucherID = pvi.PreVoucherID
		join acc.AccountLevelSL al on al.SlID = pvi.SlID
		join acc.dl on dl.DLID = a.BankDlID and dl.DlTypeID = al.DlTypeID

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
			PreVoucherItemID,
			al.AccountLevelID,
			dl.DLID,
			NULL,
			@CreatorId,
			GETDATE(),
			@CreatorId,
			GETDATE(),
			0		
	    FROM #LetterCredit a
		join acc.PreVoucherItem pvi on a.PrevoucherID = pvi.PreVoucherID
		join acc.AccountLevelSL al on al.SlID = pvi.SlID
		join acc.dl on dl.DLID = a.ProformaDLID and dl.DlTypeID = al.DlTypeID
		

		;with temp as 
		(
			select  [pi].PreVoucherItemID,
					ROW_NUMBER() over(partition by pi.PreVoucherID order by PreVoucherItemID) RowIndex
			from #LetterCredit i
			join  acc.PreVoucherItem [pi]  on [pi].PrevoucherID = i.PreVoucherID
		)

		update v
		set RowIndex = vi.RowIndex
		from acc.PreVoucherItem v
		join temp vi  on v.PreVoucherItemID = vi.PreVoucherItemID;
