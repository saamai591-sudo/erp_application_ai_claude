
--------------------------------------------------------------
CREATE   PROCEDURE [FOS].spOrderPricingPreVoucherInsert
	@OrderPricingID NVARCHAR(MAX)
--WITH ENCRYPTION
AS

	    DECLARE @DocumentNumTypeId  INT = (SELECT DocumentNumTypeID  
	                                       FROM   CFG.DocumentNumType  
	                                       WHERE EngName = 'OrderPricing'),
	            @MDEntity INT = (select Top 1 Id from mdt.DmdEntity AS de where Name = 'OrderPricing'),
			    @Sl    INT, 
				@PurchaseSl int,     
				@MaxPrevoucherID INT,
				@CreatorId int,
		        @HeaderDescription NVARCHAR(MAX),
				@HeaderDescription2 NVARCHAR(MAX)

		set @CreatorId = cfg.GetuserID();

		SELECT [value] ID
		INTO #DocumentIds
		FROM   cfg.R_FnCommaStr2Table(@OrderPricingID) 	

		select  @HeaderDescription = Description,
				@HeaderDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity 
		and [Key] = 'Header'

		select @MaxPrevoucherID = MAX(PreVoucherID)
		from acc.PreVoucher
	    --- FetchValues ---
	    SELECT  isnull(@MaxPrevoucherID,0) + ROW_NUMBER() over(order by OrderPricingID) PrevoucherID,			
				r.OrderPricingID,
				r.branchid,
				r.FinancialPeriodID,
				r.Date,
				r.ClearanceID,
				REPLACE(@HeaderDescription, '{0}', c.CotajNumber) Description,
				REPLACE(@HeaderDescription2, '{0}', c.CotajNumber) Description2,
				cast(null as varchar(max)) ErrorMessage,
				r.Number,
				dd.FullDateAlternateKey,
				dd.PersianFullDateAlternateKey
			into #OrderPricing
		from fos.OrderPricing r
		join fos.Clearance c on c.ClearanceID = r.ClearanceID
		JOIN #DocumentIds b on r.OrderPricingID = b.ID
		join cfg.DimDate dd on dd.Date = r.Date


		select 
			ROW_NUMBER() over(order by a.SpecialCostID)  ID,
			ROW_NUMBER() over(order by a.SpecialCostID) + 1 RowIndex,
			case when c.ShippingInsuranceID is not null
						then ct.SlID
				 when d.LetterCreditID is not null
						then d.CostSlID
				 when e.BillOfLadingID  is not null
						then et.SlID
				else b.SlID end SlID,
			a.Amount,
			b.Title [DESCRIPTION],
			OrderPricingID,
			a.PrevoucherID
			into #OrderPricingCost
		 from 
		 (
			select h.OrderPricingID,h.PrevoucherID,SpecialCostID,ShippingInsuranceID,LetterCreditID,BillOfLadingID,SUM(Share) Amount
			from fos.OrderPricingitem a
			join fos.OrderPricingCost b
				on a.OrderPricingCostID = b.OrderPricingCostID
			join #OrderPricing h on a.OrderPricingID = h.OrderPricingID
			group by h.OrderPricingID,h.PrevoucherID,SpecialCostID,ShippingInsuranceID,LetterCreditID,BillOfLadingID
		)a
		join fos.SpecialCost b on a.SpecialCostID = b.SpecialCostID
		left join fos.ShippingInsurance c on c.ShippingInsuranceID = a.ShippingInsuranceID
		left join fos.ShippingInsuranceType ct on ct.ShippingInsuranceTypeID = c.ShippingInsuranceTypeID
		left join fos.LetterCreditBankCost d on d.LetterCreditID = a.LetterCreditID
		left join fos.BillOfLading e on e.BillOfLadingID = a.BillOfLadingID
		left join fos.LadingType et on et.LadingTypeID = e.LadingTypeID


		select a.PrevoucherID,
			   a.OrderPricingID,
			   opi1.share Amount,
			   sagpt.SlID,
			   N'بهای اصلی سفارش' Description,
			   N'بهای اصلی سفارش' Description2,
			   s.code StuffCode
			into #MainCost
		from #OrderPricing a
		 join 
		 (
			select h.OrderPricingID,ClearanceItemID
			from fos.OrderPricingitem a
			join fos.OrderPricingCost b
				on a.OrderPricingCostID = b.OrderPricingCostID
			join #OrderPricing h on a.OrderPricingID = h.OrderPricingID
			group by h.OrderPricingID,ClearanceItemID
		) opi on opi.OrderPricingID = a.OrderPricingID
		join FOS.ClearanceItem ci on opi.ClearanceItemID = ci.ClearanceItemID
		join fos.OrderPricingItem opi1 on opi1.ClearanceItemID = ci.ClearanceItemID and opi1.PurchaseInvoiceItemID is not null
		join VND.PurchaseInvoiceItem p on opi1.PurchaseInvoiceItemID = p.PurchaseInvoiceItemID
		join STF.VWStuff s on p.StuffID = s.StuffID
		join vnd.PurchaseInvoice pi on pi.PurchaseInvoiceID = p.PurchaseInvoiceID
	    LEFT JOIN stf.StuffAccountGroupPurchaseType sagpt
	    	ON  sagpt.StuffAccountGroupID = s.StuffAccountGroupID
	    	AND sagpt.PurchaseTypeID = pi.Type

		update a 
		set ErrorMessage = isnull(ErrorMessage,'') +  'NoCalculationForOrderPricing ^' + cast(a.Number as varchar(50)) +char(10)+char(13)
		from #OrderPricing a
		left join #OrderPricingCost b on a.OrderPricingID = b.OrderPricingID
		where b.ID is null

		update a 
		set ErrorMessage = isnull(ErrorMessage,'') +  'PurchaseControlSlNotSpecified^' + StuffCode +char(10)+char(13)
		from #OrderPricing a
		join #MainCost b on a.OrderPricingID = b.OrderPricingID
		where b.SlId is null


		update a
		set ErrorMessage = 'SlOfSpecialCostNotSpecified'+ char(10)+char(13)
		from #OrderPricing a
		join #OrderPricingCost b on a.OrderPricingID = b.OrderPricingID
		WHERE slid is null

		SELECT @Sl = ConfigValue
		FROM  cfg.Configuration 
		where ConfigKey = 'OrderPricingSlID'
		
		update a
		set ErrorMessage = isnull(ErrorMessage,'') + 'InterfaceSlOfOrderPricingNotSpecified'+ char(10)+char(13)
		from #OrderPricing a
		WHERE @Sl is null

	
		if exists (select * from #OrderPricing where ErrorMessage is not null )
		BEGIN	
			select OrderPricingID,ErrorMessage from #OrderPricing
			RETURN;
	    END

	
	    -- Insert Into PreVoucher Tabel
		set identity_insert [ACC].[PreVoucher] on	
	    INSERT INTO [ACC].[PreVoucher](PreVoucherID,[BranchID],[DocumentNumtypeID],[Date],[FinancialPeriodID],[Description],[Description2],[Creator],[CreationDate],[LastEditor],[LastEditionDate],[Version])
		SELECT PreVoucherID,BranchId, @DocumentNumTypeId,date,FinancialPeriodID,Description,Description2,@CreatorId,GETDATE(),@CreatorId,GETDATE(),0
		from #OrderPricing
		set identity_insert [ACC].[PreVoucher] off
	    
	    UPDATE a
	    SET    PreVoucherID = b.PreVoucherId
		from fos.OrderPricing a
		join #OrderPricing b on a.OrderPricingID = b.OrderPricingID


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
			@Sl,			
			Description,
			Description2, 
			ISNULL(b.Amount,0)+ISNULL(c.Amount,0),
			0,     
			-1,
			1,
			ISNULL(b.Amount,0)+ISNULL(c.Amount,0),
			0,            
			@CreatorId,
			GETDATE(),   
			@CreatorId,       
			GETDATE(),        
			0
		from #OrderPricing a
		left join
		(
		select OrderPricingID,SUM(Amount) Amount
		from #OrderPricingCost
		group by OrderPricingID
		)b on a.OrderPricingID = b.OrderPricingID
		left join
		(
		select OrderPricingID,SUM(Amount) Amount
		from #MainCost
		group by OrderPricingID
		)c on a.OrderPricingID = c.OrderPricingID
		where ISNULL(b.Amount,0)+ISNULL(c.Amount,0) <> 0

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
			SlID,			
			[Description],
			[Description], 
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
		from #MainCost
		where Amount <> 0

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
			RowIndex,
			SlID,			
			[Description],
			[Description], 
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
		from #OrderPricingCost
		where Amount <> 0
	     
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
	    FROM #OrderPricing a
		join acc.PreVoucherItem b on a.PrevoucherID = b.PreVoucherID
		join acc.AccountLevelSL al on al.SlID = b.SlID
		outer apply
		(
			select top 1   ou_pi.dlid
			from fos.ClearanceItem ou_ci 
			 join fos.BillOfLadingItem ou_a on ou_a.BillOfLadingItemID = ou_ci.BillOfLadingItemID
			 join vnd.PurchaseInvoiceItem ou_b on ou_a.PurchaseInvoiceItemID = ou_b.PurchaseInvoiceItemID
			 join fos.ProformaInvoiceitem ou_p on ou_p.ProformaInvoiceItemID = ou_b.ProformaInvoiceItemID
			 join fos.ProformaInvoice ou_pi on ou_pi.ProformaInvoiceID = ou_p.ProformaInvoiceID
			where ou_ci.ClearanceID = a.ClearanceID		
		)ou
		join acc.dl on dl.DLID = ou.DLID and dl.DlTypeID = al.DlTypeID



		;with temp as 
		(
			select  [pi].PreVoucherItemID,
					ROW_NUMBER() over(partition by pi.PreVoucherID order by PreVoucherItemID) RowIndex,
					REPLACE(
					REPLACE(
					REPLACE([pi].Description
							,'@@Number@@',i.Number)
							,'@@Date_Solar@@',PersianFullDateAlternateKey)
							,'@@Date_Gregorian@@',FullDateAlternateKey) Description,
					REPLACE(
					REPLACE(
					REPLACE([pi].Description2
							,'@@Number@@',i.Number)
							,'@@Date_Solar@@',PersianFullDateAlternateKey)
							,'@@Date_Gregorian@@',FullDateAlternateKey) Description2
			from #OrderPricing i
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
		join #OrderPricing i on pi.PrevoucherID = i.PrevoucherID
