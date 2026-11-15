-------------------------------------
CREATE    PROCEDURE [AST].spRepairPreVoucherInsert
	@RepairId NVARCHAR(MAX)
	

--WITH ENCRYPTION 
	 AS 


	    DECLARE @DocumentNumTypeId  INT = (SELECT DocumentNumTypeID  FROM   CFG.DocumentNumType  WHERE EngName = 'Repair'),
	            @MDEntity INT = (select Top 1 Id from mdt.DmdEntity where Name = 'Repair'),
		        @HeaderDescription NVARCHAR(MAX),
				@HeaderDescription2 NVARCHAR(MAX),
	            @CostAssetDescription NVARCHAR(MAX),
				@CostAssetDescription2 NVARCHAR(MAX),
	            @GoodsDescription NVARCHAR(MAX),
				@GoodsDescription2 NVARCHAR(MAX),
		        @ServicesDescription NVARCHAR(MAX),
				@ServicesDescription2 NVARCHAR(MAX),
				@BaseDigit int,
				@MaxPrevoucherID int,
				@CreatorId int,
				@Culture VARCHAR(10),
				@CultureNo TinyInt
	        
		set @CreatorId = cfg.GetuserID();
		SET @Culture = CFG.GetuserCulture();

		select @CultureNo = CultureNo
		from cfg.CultureInfo
		where Culture = @Culture;

		set @BaseDigit = cfg.GetBaseCurrencyPrecision();

		SELECT [value] ID
		INTO #DocumentIds
		FROM   cfg.R_FnCommaStr2Table(@RepairId) 	


		select  @HeaderDescription = Description,
				@HeaderDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'Header'

		select  @CostAssetDescription = Description,
				@CostAssetDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'Cost/Asset'

		select  @GoodsDescription = Description,
				@GoodsDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'Goods'   

		select  @ServicesDescription = Description,
				@ServicesDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'Services'   
      
	  	    
		select @MaxPrevoucherID = MAX(PreVoucherID)
		from acc.PreVoucher
	    --- FetchValues ---
	    SELECT  isnull(@MaxPrevoucherID,0) + ROW_NUMBER() over(order by r.RepairID) PrevoucherID,	
			    r.RepairID,
				ass.BranchID,
				r.FinancialPeriodID,
				cast(null as varchar(max)) ErrorMessage,
				@HeaderDescription Description,
				@HeaderDescription2 Description2,
				r.AssetID,
				oa.AssetSettingID,
				case when r.Type = 1 then [RepairCost] else FixAsset end SlID ,
				r.Date,
				r.Type,
				isnull(rsc1.price,0) + isnull(rsc2.price,0) Cost,
				@CostAssetDescription CostAssetDescription,
				@CostAssetDescription2 CostAssetDescription2,
				dd.FullDateAlternateKey,
				dd.PersianFullDateAlternateKey,
				r.Number,
				ass.Title AssetTitle,
				ass.Title2 AssetTitle2,
				ass.Plaque
			into #Repair
	    FROM   AST.Repair r
		join AST.Asset ass on r.AssetID = ass.AssetID
		JOIN #DocumentIds b on r.RepairID = b.ID
		JOIN cfg.DimDate DD on DD.Date = r.Date
		left join
		(
		select RepairID, sum(price) price
		from ast.RepairServiceCost 
		group by RepairID 
		)rsc1 on rsc1.RepairID = r.RepairID
		left join
		(
		select RepairID, sum(price) price
		from ast.RepairStuffCost 
		group by RepairID 		
		)rsc2 on rsc2.RepairID = r.RepairID
		join [AST].[FnFindCategoryAccount]() cat on cat.AssetCategoryID = ass.AssetCategoryID
		outer apply
		(
		select top 1 AssetSettingID
		from ast.AssetSetting
		where AssetID = r.AssetID
		and Date <= r.Date
		order by date desc
		)oa
	    WHERE r.PreVoucherID is null         
	    	    
		update a
		set ErrorMessage = 'معین هزینه تعمیر و نگهداری در گروه دارایی مورد نظر انتخاب نشده است.'+ char(10)+char(13)
		from #Repair a
		WHERE SlID IS NULL and a.Type = 1

		update a
		set ErrorMessage = isnull(ErrorMessage,'') + 'معین دارایی ثابت در گروه دارایی مورد نظر انتخاب نشده است.'+ char(10)+char(13)
		from #Repair a
		WHERE SlID IS NULL and a.Type <> 1

		if exists (select * from #Repair where ErrorMessage is not null )
		BEGIN	

			select RepairID,ErrorMessage from #Repair
			RETURN;
	    END

		select *
		into #RepairStuffCost
		from
		(
			select  h.PrevoucherID,
					sagpt.SlID,
					a.Price,
					a.RepairStuffCostID,
					@GoodsDescription  Description,
					@GoodsDescription2  Description2
			from ast.RepairStuffCost a
			JOIN #Repair h on a.RepairID = h.RepairID
			JOIN vnd.PurchaseInvoiceItem b on a.PurchaseInvoiceItemID = b.PurchaseInvoiceItemID
			JOIN vnd.PurchaseInvoice pi on pi.PurchaseInvoiceID = b.PurchaseInvoiceID
			JOIN stf.StuffDetail sd ON  b.StuffID = sd.StuffID
			JOIN stf.StuffAccountGroup sag ON  sd.StuffAccountGroupID = sag.StuffAccountGroupID
			LEFT JOIN stf.StuffAccountGroupPurchaseType sagpt
	    		ON  sagpt.StuffAccountGroupID = sag.StuffAccountGroupID
	    		AND sagpt.PurchaseTypeID = pi.Type

			UNION ALL
		
			select  h.PrevoucherID,
					wip.SlID,
					a.Price,
					a.RepairStuffCostID,
					@GoodsDescription  Description,
					@GoodsDescription2  Description2
			from ast.RepairStuffCost a
			JOIN #Repair h on a.RepairID = h.RepairID
			JOIN stc.OutgoingItem b on a.OutgoingItemID = b.OutgoingItemID
			JOIN stc.Outgoing o on o.OutgoingID = b.OutgoingID
			JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
				ON o.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
			JOIN stf.StuffDetail sd ON  b.StuffID = sd.StuffID
			JOIN stf.StuffAccountGroup sag ON  sd.StuffAccountGroupID = sag.StuffAccountGroupID
			JOIN stf.StockDocumentTypeSlDl wip ON   wip.StuffAccountGroupID = sag.StuffAccountGroupID
												and wip.StockDocumentTypeID = sdtb.StockDocumentTypeID
												and (wip.dlid is null or wip.DlID = o.DeliverDlID)
		)A

	    -- Insert Into PreVoucher Tabel
		set identity_insert [ACC].[PreVoucher] on	
	    INSERT INTO [ACC].[PreVoucher](PreVoucherID,BranchID,[DocumentNumtypeID],[Date],[FinancialPeriodID],[Description],[Description2],[Creator],[CreationDate],[LastEditor],[LastEditionDate],[Version])
		SELECT PreVoucherID,BranchId,@DocumentNumTypeId,date,FinancialPeriodID,Description,Description2,@CreatorId,GETDATE(),@CreatorId,GETDATE(),0
		from #Repair
		set identity_insert [ACC].[PreVoucher] off
	    
	    UPDATE a
	    SET    PreVoucherID = b.PreVoucherId
		from ast.Repair a
		join #Repair b on a.RepairID = b.RepairID
	    

	    INSERT INTO ACC.PreVoucherItem (PreVoucherID ,RowIndex,SlID,DESCRIPTION , Description2,Debit,Credit,CurrencyID ,CurrencyRate, CurrencyDebit, CurrencyCredit,Creator,  CreationDate,LastEditor,LastEditionDate,Version,BaseDocumentName,BaseDocumentID)
	    SELECT							PreVoucherId,1,SlID,CostAssetDescription,CostAssetDescription2,Cost,0,-1,1,Cost,0,@CreatorId,GETDATE(),@CreatorId,GETDATE(),0,'Repair',RepairID
		from #Repair


		INSERT INTO ACC.PreVoucherItem (PreVoucherID ,RowIndex,SlID,DESCRIPTION , Description2,Debit,Credit,CurrencyID ,CurrencyRate, CurrencyDebit, CurrencyCredit,Creator,  CreationDate,LastEditor,LastEditionDate,Version,BaseDocumentName,BaseDocumentID)
		SELECT							PreVoucherId,1,SlID,Description,Description2,0,Price,-1,1,0,Price,@CreatorId,GETDATE(),@CreatorId,GETDATE(),0,'RepairStuffCost',RepairStuffCostID
		from #RepairStuffCost
			
	        
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
	        IsAutoGenerated,
	        Creator,
	        CreationDate,
	        LastEditor,
	        LastEditionDate,
	        Version,
			BaseDocumentName,
			BaseDocumentID
	        )
	    SELECT  b.PreVoucherId,
	            1,
	            a.SlID,
	            @ServicesDescription,
	            @ServicesDescription2,
	            0,
	            Price,
	            -1,
	            1,
	            0,
	            Price,
	            1,
	            @CreatorId,
	            GETDATE(),
	            @CreatorId,
	            GETDATE(),
	            0,
				'RepairServiceCost',
				RepairServiceCostID
	    FROM    ast.RepairServiceCost a       						   
	    join #Repair b on a.RepairID = b.RepairID


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
	        SELECT PreVoucherItemID,
	               AccountLevelID,
	               b.dlid,
	               NULL,
	               @CreatorId,
	               GETDATE(),
	               @CreatorId,
	               GETDATE(),
	               0
	        FROM #Repair h
			join acc.PreVoucherItem pvi on pvi.PreVoucherID = h.PrevoucherID
			join Acc.AccountLevelSL al on al.SlID = pvi.SlID
			join ast.AssetSettingDl b on b.AssetSettingID = h.AssetSettingID and al.DlTypeID = b.DlTypeID

		;with temp as 
		(
			select  [pi].PreVoucherItemID,
					ROW_NUMBER() over(partition by pi.PreVoucherID order by PreVoucherItemID) RowIndex,
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE([pi].Description,
						'@@Plaque@@',i.Plaque),
						'@@AssetTitle@@',i.AssetTitle),
						'@@Number@@',i.Number),
						'@@Date_Gregorian@@',FullDateAlternateKey),
						'@@Date_Solar@@',PersianFullDateAlternateKey) [Description],
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE([pi].Description2,
						'@@Plaque@@',i.Plaque),
						'@@AssetTitle@@',i.AssetTitle2),
						'@@Number@@',i.Number),
						'@@Date_Gregorian@@',FullDateAlternateKey),
						'@@Date_Solar@@',PersianFullDateAlternateKey)[Description2]
			from #Repair i
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
					REPLACE(
					REPLACE([pi].Description,
						'@@Plaque@@',i.Plaque),
						'@@AssetTitle@@',i.AssetTitle),
						'@@Number@@',i.Number),
						'@@Date_Gregorian@@',FullDateAlternateKey),
						'@@Date_Solar@@',PersianFullDateAlternateKey)		
		,
			[Description2] =
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE([pi].Description2,
						'@@Plaque@@',i.Plaque),
						'@@AssetTitle@@',i.AssetTitle2),
						'@@Number@@',i.Number),
						'@@Date_Gregorian@@',FullDateAlternateKey),
						'@@Date_Solar@@',PersianFullDateAlternateKey)
		from acc.PreVoucher pi
		join #Repair i on pi.PrevoucherID = i.PrevoucherID
