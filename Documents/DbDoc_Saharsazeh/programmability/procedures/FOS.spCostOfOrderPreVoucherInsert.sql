
Create   PROCEDURE [FOS].[spCostOfOrderPreVoucherInsert]
	@CostOfOrderID NVARCHAR(MAX)
--WITH ENCRYPTION
AS
	DECLARE @DocumentNumTypeId  INT = (SELECT DocumentNumTypeID  
	                                    FROM   CFG.DocumentNumType  
	                                    WHERE EngName = 'CostOfOrder'),
	        @MaxPrevoucherID INT,
			@PaymentsAccountId int,
			@CreatorId int,
			@HeaderCostOfOrder NVARCHAR(MAX),
			@MDEntity INT = (select Top 1 Id from mdt.DmdEntity AS de where Name = 'CostOfOrder'),
			@OrderCost NVARCHAR(MAX),
			@OrderCost2 NVARCHAR(MAX),
			@HeaderCostOfOrder2 NVARCHAR(MAX),
			@PurchaseControlDescription NVARCHAR(MAX),
			@PurchaseControlDescription2 NVARCHAR(MAX),
			@PayableAccountDescription NVARCHAR(MAX),
			@PayableAccountDescription2 NVARCHAR(MAX);

	set @CreatorId = cfg.GetuserID();

	SELECT @HeaderCostOfOrder = [Description]
	FROM  CFG.[VoucherDescription] 
	where MDEntityID = @MDEntity and [Key] = 'Header'

	SELECT @HeaderCostOfOrder2 = Description2
	FROM  CFG.[VoucherDescription] 
	where MDEntityID = @MDEntity and [Key] = 'Header'

				SELECT @PurchaseControlDescription = Description,
			           @PurchaseControlDescription2 = Description2 
		FROM  CFG.[VoucherDescription] where MDEntityID = @MDEntity and [Key] = 'PurchaseControl'

		SELECT @OrderCost = Description,
			@OrderCost2 = Description2 
		FROM  CFG.[VoucherDescription] where MDEntityID = @MDEntity and [Key] = 'OrderCost'
		
		select @PayableAccountDescription = Description,
			   @PayableAccountDescription2 = Description2
		from CFG.VoucherDescription where  MDEntityID = @MDEntity AND  [Key] = 'PayableAccount'

	SELECT @PaymentsAccountId = ConfigValue
	FROM  cfg.Configuration 
	where ConfigKey = 'PaymentsAccountId'

	SELECT [value] ID
	INTO #DocumentIds
	FROM   cfg.R_FnCommaStr2Table(@CostOfOrderID) 	

	select @MaxPrevoucherID = MAX(PreVoucherID)
	from acc.PreVoucher

	    --- FetchValues ---
	    SELECT  isnull(@MaxPrevoucherID,0) + ROW_NUMBER() over(order by CostOfOrderID) PrevoucherID,	
				CostOfOrderID,
				r.branchid,
				r.FinancialPeriodID,
				r.BaseType,
				r.Date,
                @HeaderCostOfOrder Description,
				@HeaderCostOfOrder2 [Description2],
				ProformaInvoiceID,
				RegistrationID,
				BillOfLadingID,
				Number,
				ClearanceID,
				DD.FullDateAlternateKey,
				DD.PersianFullDateAlternateKey
		into #CostOfOrder
		from fos.[CostOfOrder] r
		JOIN #DocumentIds b on r.CostOfOrderID = b.ID
		JOIN cfg.DimDate DD on DD.[Date] = r.[Date]

		Select   r.Amount ,
				 party.DlID  ,								   
				 s.SlID DebitSlID,
				 case when r.PurchaseInvoiceItemID is not null then sd.SlID else 
					@PaymentsAccountId end CreditSlID,
				 st.Code,
                REPLACE(@OrderCost,
				'@@Description@@', isnull(r.Description,'')) Description,
                REPLACE(@OrderCost2,
				'@@Description@@', isnull(r.Description2,'')) Description2,
                REPLACE(@PurchaseControlDescription,
				'@@Description@@', isnull(r.Description,''))  PurchaseControlDescription,
                REPLACE(@PurchaseControlDescription2,
				'@@Description@@', isnull(r.Description2,''))  PurchaseControlDescription2,
                REPLACE(@PayableAccountDescription,
				'@@Description@@', isnull(r.Description,''))  PayableAccountDescription,
                REPLACE(@PayableAccountDescription2,
				'@@Description@@', isnull(r.Description2,''))  PayableAccountDescription2,
				 ROW_NUMBER() over(order by CostOfOrderItemID) RowIndex,
				 h.PrevoucherID,
				 r.CostOfOrderItemID,
				DD.FullDateAlternateKey,
				pi.PurchaseInvoiceID,
				DD.PersianFullDateAlternateKey,
				h.Number,
				r.PurchaseInvoiceItemID,
				r.CostOfOrderID
			into #CostOfOrderItem
		from fos.[CostOfOrderItem] r
		join #CostOfOrder h on h.CostOfOrderID = r.CostOfOrderID
		join cfg.party on party.PartyID = r.PartyID
		join fos.SpecialCost s on s.SpecialCostID = r.SpecialCostID
		left join vnd.PurchaseInvoiceItem pii on pii.PurchaseInvoiceitemID = r.PurchaseInvoiceItemID
		left join vnd.PurchaseInvoice pi on pi.PurchaseInvoiceID = pii.PurchaseInvoiceID
		left join cfg.Currency c on c.CurrencyID = pi.CurrencyID
		left join stf.StuffDetail sd on sd.StuffID = pii.StuffID
		left join stf.stuff st on st.StuffID = sd.StuffID
		JOIN cfg.DimDate DD on DD.[Date] = h.[Date]


		--select * from #CostOfOrderItem
	    -- Insert Into PreVoucher Tabel
		set identity_insert [ACC].[PreVoucher] on		
	    INSERT INTO [ACC].[PreVoucher](PreVoucherID,[BranchID],[DocumentNumtypeID],[Date],[FinancialPeriodID],[Description],[Description2],[Creator],[CreationDate],[LastEditor],[LastEditionDate],[Version])
		SELECT PreVoucherID,BranchId, @DocumentNumTypeId,date,FinancialPeriodID,Description,Description2,@CreatorId,GETDATE(),@CreatorId,GETDATE(),0
		from #CostOfOrder
		set identity_insert [ACC].[PreVoucher] off
	    
	    UPDATE a
	    SET    PreVoucherID = b.PreVoucherId
		from fos.[CostOfOrder] a
		join #CostOfOrder b on a.[CostOfOrderID] = b.[CostOfOrderID]
	    

	---------------------------------------------------Insert CostOfOrder---------------------------------------
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
			RowIndex,
			DebitSlID,			
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
			'CostOfOrderItem',
			CostOfOrderItemID
		from #CostOfOrderItem h 
		order by RowIndex
---------------------------------------------------Insert PurchaseControl---------------------------------------

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
			CreditSlID,			
			h.PurchaseControlDescription,
			h.PurchaseControlDescription2, 
			0,
			Amount,
			-1,
			1,
			0,
			amount,            
			@CreatorId,
			GETDATE(),   
			@CreatorId,       
			GETDATE(),        
			0,
			'CostOfOrderItem',
			CostOfOrderItemID
		from #CostOfOrderItem h
		where h.PurchaseInvoiceItemID is not null
		order by RowIndex

------------------------------------------------Insert AccountPayble---------------------------------------------
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
			CreditSlID,			
			PayableAccountDescription,
			PayableAccountDescription2, 
			0,     
			Amount,
			-1,
			1,
			0,            
			amount,
			@CreatorId,
			GETDATE(),   
			@CreatorId,       
			GETDATE(),        
			0,
			'CostOfOrderItem',
			CostOfOrderItemID
		from #CostOfOrderItem h
		where h.PurchaseInvoiceItemID is null
		order by RowIndex
		
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
			b.PreVoucherItemID,
			al.AccountLevelID,
			dl.DlID,
			NULL,
			@CreatorId,
			GETDATE(),
			@CreatorId,
			GETDATE(),
			0		
	    
	    FROM #CostOfOrderItem a
		join acc.PreVoucherItem b on b.BaseDocumentName = 'CostOfOrderItem' and b.BaseDocumentID = a.CostOfOrderItemID
		join acc.AccountLevelSL al on al.SlID = b.SlID
		join acc.dl on dl.DLID = a.DlID and dl.DlTypeID = al.DlTypeID
		left join acc.PreVoucherItemAccountLevel pval on pval.PreVoucherItemID = b.PreVoucherItemID and pval.AccountLevelID = al.AccountLevelID
		where pval.PreVoucherItemAccountLevelID is null
		group by b.PreVoucherItemID,
			al.AccountLevelID,
			dl.DLID




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
			b.PreVoucherItemID,
			al.AccountLevelID,
			dl.DLID,
			NULL,
			@CreatorId,
			GETDATE(),
			@CreatorId,
			GETDATE(),
			0			    
	    FROM #CostOfOrder a
		join acc.PreVoucherItem b on a.PrevoucherID = b.PreVoucherID
		join acc.AccountLevelSL al on al.SlID = b.SlID
		join fos.ProformaInvoice p on p.ProformaInvoiceID = a.ProformaInvoiceID
		join acc.dl on dl.DLID = p.DLID and dl.DlTypeID = al.DlTypeID
		left join acc.PreVoucherItemAccountLevel pval on pval.PreVoucherItemID = b.PreVoucherItemID and pval.AccountLevelID = al.AccountLevelID
		where pval.PreVoucherItemAccountLevelID is null
		group by b.PreVoucherItemID,
			al.AccountLevelID,
			dl.DLID

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
			b.PreVoucherItemID,
			al.AccountLevelID,
			dl.DLID,
			NULL,
			@CreatorId,
			GETDATE(),
			@CreatorId,
			GETDATE(),
			0			    
	    FROM #CostOfOrder a
		join acc.PreVoucherItem b on a.PrevoucherID = b.PreVoucherID
		join acc.AccountLevelSL al on al.SlID = b.SlID
		join fos.Registration r on r.RegistrationID = a.RegistrationID
		join fos.ProformaInvoice p on p.ProformaInvoiceID = r.ProformaInvoiceID
		join acc.dl on dl.DLID = p.DLID and dl.DlTypeID = al.DlTypeID
		left join acc.PreVoucherItemAccountLevel pval on pval.PreVoucherItemID = b.PreVoucherItemID and pval.AccountLevelID = al.AccountLevelID
		where pval.PreVoucherItemAccountLevelID is null
		group by b.PreVoucherItemID,
			al.AccountLevelID,
			dl.DLID

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
			b.PreVoucherItemID,
			al.AccountLevelID,
			dl.DLID,
			NULL,
			@CreatorId,
			GETDATE(),
			@CreatorId,
			GETDATE(),
			0			    
	    FROM #CostOfOrder a
		join acc.PreVoucherItem b on a.PrevoucherID = b.PreVoucherID
		join acc.AccountLevelSL al on al.SlID = b.SlID
		join fos.BillOfLadingItem bli on bli.BillOfLadingID = a.BillOfLadingID
		join vnd.PurchaseInvoiceItem pii on pii.PurchaseInvoiceItemID = bli.PurchaseInvoiceItemID
		join fos.ProformaInvoiceitem p on p.ProformaInvoiceItemID = pii.ProformaInvoiceItemID
		join fos.ProformaInvoice pi on pi.ProformaInvoiceID = p.ProformaInvoiceID
		join acc.dl on dl.DLID = pi.DLID and dl.DlTypeID = al.DlTypeID
		left join acc.PreVoucherItemAccountLevel pval on pval.PreVoucherItemID = b.PreVoucherItemID and pval.AccountLevelID = al.AccountLevelID
		where pval.PreVoucherItemAccountLevelID is null
		group by b.PreVoucherItemID,
			al.AccountLevelID,
			dl.DLID

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
			b.PreVoucherItemID,
			al.AccountLevelID,
			dl.DLID,
			NULL,
			@CreatorId,
			GETDATE(),
			@CreatorId,
			GETDATE(),
			0			    
	    FROM #CostOfOrder a
		join acc.PreVoucherItem b on a.PrevoucherID = b.PreVoucherID
		join acc.AccountLevelSL al on al.SlID = b.SlID
		join fos.ClearanceItem ci on ci.ClearanceID = a.ClearanceID
		join fos.BillOfLadingItem bli on bli.BillOfLadingItemID = ci.BillOfLadingItemID
		join vnd.PurchaseInvoiceItem pii on pii.PurchaseInvoiceItemID = bli.PurchaseInvoiceItemID
		join fos.ProformaInvoiceitem p on p.ProformaInvoiceItemID = pii.ProformaInvoiceItemID
		join fos.ProformaInvoice pi on pi.ProformaInvoiceID = p.ProformaInvoiceID
		join acc.dl on dl.DLID = pi.DLID and dl.DlTypeID = al.DlTypeID
		left join acc.PreVoucherItemAccountLevel pval on pval.PreVoucherItemID = b.PreVoucherItemID and pval.AccountLevelID = al.AccountLevelID
		where pval.PreVoucherItemAccountLevelID is null
		group by b.PreVoucherItemID,
			al.AccountLevelID,
			dl.DLID




;WITH temp AS 
(
    SELECT PreVoucherItemID,
           ROW_NUMBER() OVER(PARTITION BY pi.PreVoucherID ORDER BY PreVoucherItemID) AS RowIndex,
           REPLACE(
           REPLACE(
           REPLACE(pi.[Description],
           '@@Date_Gregorian@@', ISNULL(i.FullDateAlternateKey, '')),
           '@@Date_Solar@@', ISNULL(i.PersianFullDateAlternateKey, '')),
           '@@Number@@', ISNULL(i.Number, '')) AS [Description],
           REPLACE(
           REPLACE(
           REPLACE(pi.Description2,
           '@@Date_Gregorian@@', ISNULL(i.FullDateAlternateKey, '')),
           '@@Date_Solar@@', ISNULL(i.PersianFullDateAlternateKey, '')),
           '@@Number@@', ISNULL(i.Number, '')) AS [Description2]
    FROM #CostOfOrder i
    JOIN acc.PreVoucherItem pi ON pi.PreVoucherID = i.PreVoucherID
)    
update v
set RowIndex = vi.RowIndex,
	Description = vi.Description,
	Description2 = vi.Description2
from acc.PreVoucherItem v
join temp vi  on v.PreVoucherItemID = vi.PreVoucherItemID



UPDATE p
SET [Description] = 
					REPLACE(
					REPLACE(
					REPLACE(p.[Description],
					'@@Date_Gregorian@@', ISNULL(i.FullDateAlternateKey, '')),
					'@@Date_Solar@@', ISNULL(i.PersianFullDateAlternateKey, '')),
					'@@Number@@', ISNULL(i.Number, '')),
    Description2 = 
					REPLACE(
					REPLACE(
					REPLACE(p.Description2,
					'@@Date_Gregorian@@', ISNULL(FullDateAlternateKey, '')),
					'@@Date_Solar@@', ISNULL(PersianFullDateAlternateKey, '')),
					'@@Number@@', ISNULL(i.Number, ''))
FROM ACC.PreVoucher p
JOIN #CostOfOrder i ON i.PrevoucherID = p.PrevoucherID;


