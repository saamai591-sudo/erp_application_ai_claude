
------------------------------------------------------------
CREATE    PROCEDURE [FOS].spClearancePreVoucherInsert
	@ClearanceID  NVARCHAR(MAX)
--WITH ENCRYPTION
AS


	    DECLARE @DocumentNumTypeId  INT = (SELECT DocumentNumTypeID  
	                                       FROM   CFG.DocumentNumType  
	                                       WHERE EngName = 'Clearance'),
				@PayableAccountSl int,     
	            @MaxPrevoucherID     INT,
				@CreatorId int,
				@MDEntity INT = (select Top 1 Id from mdt.DmdEntity AS de where Name = 'Clearance'),
				@HeaderDescription  nvarchar(max),
				@HeaderDescription2 nvarchar(max),
				@CustomCostDescription  nvarchar(max),
				@CustomCostDescription2  nvarchar(max),
				@PayableAccountsDescription  nvarchar(max),
				@PayableAccountsDescription2  nvarchar(max)

		set @CreatorId = cfg.GetuserID();

		select  @HeaderDescription = Description,
				@HeaderDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity 
		and   [Key] = 'Header'

		select  @CustomCostDescription = Description,
				@CustomCostDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity 
		and   [Key] = 'CustomCost'

		select  @PayableAccountsDescription = Description,
				@PayableAccountsDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity 
		and   [Key] = 'PayableAccount'

		SELECT [value] ID
		INTO #DocumentIds
		FROM   cfg.R_FnCommaStr2Table(@ClearanceID) 	

		select @MaxPrevoucherID = MAX(PreVoucherID)
		from acc.PreVoucher
	    --- FetchValues ---
	    SELECT  isnull(@MaxPrevoucherID,0) + ROW_NUMBER() over(order by ClearanceID) PrevoucherID,	
				ClearanceID,
				r.branchid,
				r.FinancialPeriodID,
				r.Date,
				@HeaderDescription HeaderDescription ,
				@HeaderDescription2 HeaderDescription2 ,
				r.Description,
				r.Description2,
				@PayableAccountsDescription PayableAccountsDescription,
				@PayableAccountsDescription2  PayableAccountsDescription2,
				p.DlID,
				cast(null as varchar(max)) ErrorMessage,
				FullDateAlternateKey,
				dd.PersianFullDateAlternateKey,
				r.Number,
				r.CotajNumber
			into #Clearance
		from fos.Clearance r
		join cfg.customs b on r.EntranceCustomsID = b.customsid
		join cfg.Party p on p.PartyID = b.partyid
		JOIN #DocumentIds di on r.ClearanceID = di.ID
		join cfg.DimDate dd on dd.Date = r.Date
		
		

		SELECT @PayableAccountSl = ConfigValue
		FROM  cfg.Configuration 
		where ConfigKey = 'PaymentsAccountId'

		Select  
				h.ClearanceID,
				ccc.Amount,
				ROW_NUMBER() over(order by ccc.ClearanceCustomsCostID) Rno,
				REPLACE(
				REPLACE(@CustomCostDescription,
					'@@CostTitle@@',isnull(sc.Title,'')),
					'@@ItemDescription@@',isnull(ci.Description,'')) [Description],
				REPLACE(
				REPLACE(@CustomCostDescription2,
					'@@CostTitle@@',isnull(sc.Title2,'')),
					'@@ItemDescription@@',isnull(ci.Description2,'')) [Description2],
				p.DLID,
				sc.SlID,
				h.PrevoucherID,
				ClearanceCustomsCostID
		into #ClearanceCost
		from fos.ClearanceCustomsCost ccc
		join fos.ClearanceItem ci on ccc.ClearanceItemID = ci.ClearanceItemID
		join fos.BillOfLadingItem b on b.BillOfLadingItemID = ci.BillOfLadingItemID
		join vnd.PurchaseInvoiceItem pii on pii.PurchaseInvoiceItemID = b.PurchaseInvoiceItemID
		join fos.ProformaInvoiceItem pi on pi.ProformaInvoiceItemID = pii.ProformaInvoiceItemID
		join fos.ProformaInvoice p on p.ProformaInvoiceID = pi.ProformaInvoiceID
		join fos.SpecialCost sc on sc.SpecialCostID = ccc.SpecialCostID
		join #Clearance h on ccc.ClearanceID = h.ClearanceID


		update a
		set ErrorMessage = 'هزینه های ترخیص گمرک مشخص نشده است.'+ char(10)+char(13)
		from #Clearance a
		left join #ClearanceCost b on a.ClearanceID = b.ClearanceID
		WHERE b.ClearanceID is null

	
		if exists (select * from #Clearance where ErrorMessage is not null )
		BEGIN	
			select ClearanceID,ErrorMessage from #Clearance
			RETURN;
	    END

	    -- Insert Into PreVoucher Tabel
		set identity_insert [ACC].[PreVoucher] on	
	    INSERT INTO [ACC].[PreVoucher](PreVoucherID,[BranchID],[DocumentNumtypeID],[Date],[FinancialPeriodID],[Description],[Description2],[Creator],[CreationDate],[LastEditor],[LastEditionDate],[Version])
		SELECT PreVoucherID,BranchId, @DocumentNumTypeId,date,FinancialPeriodID,HeaderDescription,HeaderDescription2,@CreatorId,GETDATE(),@CreatorId,GETDATE(),0
		from #Clearance
		set identity_insert [ACC].[PreVoucher] off
	    
	    UPDATE a
	    SET    PreVoucherID = b.PreVoucherId
		from fos.Clearance a
		join #Clearance b on a.ClearanceID = b.ClearanceID
	    
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
			Rno,
			SlID,			
			Description,
			Description2,
			Amount,
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
			'ClearanceCustomsCost',
			ClearanceCustomsCostID
		from #ClearanceCost


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
			PayableAccountsDescription,
			PayableAccountsDescription2, 
			0,
			Amount,
			-1,
			1,
			0,
			Amount,            
			@CreatorId,
			GETDATE(),   
			@CreatorId,       
			GETDATE(),        
			0
		from #Clearance a
		join
		(
		select ClearanceID,SUM(Amount) Amount
		from #ClearanceCost
		group by ClearanceID
		)b on a.ClearanceID = b.ClearanceID


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
			a.DlID,
			NULL,
			@CreatorId,
			GETDATE(),
			@CreatorId,
			GETDATE(),
			0		
	    FROM #Clearance a
		join acc.PreVoucherItem  b on a.PrevoucherID = b.PreVoucherID
		join acc.AccountLevelSL al on al.SlID = b.SlID
		join acc.dl on dl.DLID = a.DlID and dl.DlTypeID = al.DlTypeID



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
			c.DLID,
			NULL,
			@CreatorId,
			GETDATE(),
			@CreatorId,
			GETDATE(),
			0		
	    FROM #ClearanceCost c 
		join acc.PreVoucherItem pvi on pvi.BaseDocumentName = 'ClearanceCustomsCost' and pvi.BaseDocumentID = c.ClearanceCustomsCostID
		join  acc.AccountLevelSL al on  al.SlID = pvi.SlID 
		join acc.dl on dl.DLID = c.DLID and dl.DlTypeID = al.DlTypeID


		;with temp as 
		(
			select  [pi].PreVoucherItemID,
					ROW_NUMBER() over(partition by pi.PreVoucherID order by PreVoucherItemID) RowIndex,
				    REPLACE(
				    REPLACE(
				    REPLACE(
				    REPLACE(
				    REPLACE(pi.[Description],
				   '@@Description@@', ISNULL(i.Description, '')),
				   '@@CotajNumber@@', ISNULL(i.CotajNumber, '')),
				   '@@Date_Gregorian@@', ISNULL(i.FullDateAlternateKey, '')),
				   '@@Date_Solar@@', ISNULL(i.PersianFullDateAlternateKey, '')),
				   '@@Number@@', ISNULL(i.Number, '')) AS [Description],
				    REPLACE(
				    REPLACE(
				    REPLACE(
				    REPLACE(
				    REPLACE(pi.[Description2],
				   '@@Description@@', ISNULL(i.Description2, '')),
				   '@@CotajNumber@@', ISNULL(i.CotajNumber, '')),
				   '@@Date_Gregorian@@', ISNULL(i.FullDateAlternateKey, '')),
				   '@@Date_Solar@@', ISNULL(i.PersianFullDateAlternateKey, '')),
				   '@@Number@@', ISNULL(i.Number, '')) AS [Description2]
			from #Clearance i
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
				    REPLACE(b.[Description],
				   '@@Description@@', ISNULL(a.Description, '')),
				   '@@CotajNumber@@', ISNULL(a.CotajNumber, '')),
				   '@@Date_Gregorian@@', ISNULL(a.FullDateAlternateKey, '')),
				   '@@Date_Solar@@', ISNULL(a.PersianFullDateAlternateKey, '')),
				   '@@Number@@', ISNULL(a.Number, '')),
			[Description2]=
				    REPLACE(
				    REPLACE(
				    REPLACE(
				    REPLACE(
				    REPLACE(b.[Description2],
				   '@@Description@@', ISNULL(a.Description2, '')),
				   '@@CotajNumber@@', ISNULL(a.CotajNumber, '')),
				   '@@Date_Gregorian@@', ISNULL(a.FullDateAlternateKey, '')),
				   '@@Date_Solar@@', ISNULL(a.PersianFullDateAlternateKey, '')),
				   '@@Number@@', ISNULL(a.Number, ''))
		from #Clearance a
		join acc.PreVoucher b on a.PrevoucherID = b.PreVoucherID   

