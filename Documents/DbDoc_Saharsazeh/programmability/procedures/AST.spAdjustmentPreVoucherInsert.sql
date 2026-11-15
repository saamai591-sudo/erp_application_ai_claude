CREATE    PROCEDURE [AST].[spAdjustmentPreVoucherInsert]
	@AdjustmentId NVARCHAR(MAX)
--WITH ENCRYPTION 
	 AS 
	
	    DECLARE @DocumentNumTypeId  INT = (SELECT DocumentNumTypeID  FROM   CFG.DocumentNumType  WHERE EngName = 'Adjustment'),
	            @MDEntity INT = (select Top (1) Id from mdt.DmdEntity where Name = 'Adjustment'),
		        @HeaderDescription NVARCHAR(MAX),
				@HeaderDescription2 NVARCHAR(MAX),
	            @AssetDescription NVARCHAR(MAX),
				@AssetDescription2 NVARCHAR(MAX),
	            @OpositSideDescription NVARCHAR(MAX),
				@OpositSideDescription2 NVARCHAR(MAX),
				@MaxPrevoucherID int,
				@CreatorId int,
				@Culture VARCHAR(10),
				@CultureNo TinyInt,
				@CreditSlID int
		
		select @CreditSlID = ConfigValue from cfg.Configuration where ConfigKey = 'AssetControlSl'
	    
		set @CreatorId = cfg.GetuserID();
		SET @Culture = CFG.GetuserCulture();

		select @CultureNo = CultureNo
		from cfg.CultureInfo
		where Culture = @Culture;

		SELECT [value] ID
		INTO #DocumentIds
		FROM   cfg.R_FnCommaStr2Table(@AdjustmentId) 	

		select  @HeaderDescription = Description,
				@HeaderDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'Header'

		select  @AssetDescription = Description,
				@AssetDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'Asset'

		select  @OpositSideDescription = Description,
				@OpositSideDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'OpositSide'   
	    
	  	    
		select @MaxPrevoucherID = MAX(PreVoucherID)
		from acc.PreVoucher
	    --- FetchValues ---
	    SELECT  isnull(@MaxPrevoucherID,0) + ROW_NUMBER() over(order by AdjustmentID) PrevoucherID,	
				AdjustmentID,
				c.FinancialPeriodID,
				@HeaderDescription Description,
				@HeaderDescription2 Description2,
				cast(null as varchar(max)) ErrorMessage,
				c.date,
				c.Number,
				c.BranchId,
				dd.FullDateAlternateKey,
				dd.PersianFullDateAlternateKey
			into #Adjustment
	    FROM   AST.Adjustment c
		JOIN #DocumentIds b on c.AdjustmentID = b.ID
		JOIN cfg.DimDate DD on DD.Date = c.Date
	    WHERE c.PreVoucherID is null          
	    

		select  a.SlID,
				c.FixAsset,
				a.PrevoucherID,
				a.AdjustmentID,
				a.BaseDocumentType,
				b.AssetCategoryID,
				Amount,
				REPLACE(@AssetDescription,
					'@@AssetTitle@@',b.Title) AssetDescription,
				REPLACE(@AssetDescription2,
					'@@AssetTitle@@',b.Title2) AssetDescription2,
				REPLACE(@OpositSideDescription,
					'@@AssetTitle@@',b.Title) OpositSideDescription,
				REPLACE(@OpositSideDescription2,
					'@@AssetTitle@@',b.Title2) OpositSideDescription2
			into #Adjustmentitem
		from
		(
			 select @CreditSlID SlID,
					h.PrevoucherID,
					h.AdjustmentID,
					ai.AssetID,
					ai.BaseDocumentType,
					ai.Amount
			 from ast.Adjustmentitem ai
			 join #Adjustment h on h.AdjustmentID = ai.AdjustmentID
			 where ai.BaseDocumentType = 1
			 union all
			 select 
			 case
			 when 
			 stf.type = 0 then sagpt.SlID 
			 when stf.type = 1 then sd.SlID end slid,
					h.PrevoucherID,
					h.AdjustmentID,
					ai.AssetID,
					ai.BaseDocumentType,
					ai.Amount
			 from ast.Adjustmentitem ai
			 join #Adjustment h on h.AdjustmentID = ai.AdjustmentID
			 join vnd.PurchaseInvoiceItem pii on ai.BaseDocumentType = 2 and ai.BaseDocumentID = pii.PurchaseInvoiceItemID
			 JOIN vnd.PurchaseInvoice pi on pi.PurchaseInvoiceID = pii.PurchaseInvoiceID
			 join stf.StuffDetail sd on sd.StuffID = pii.StuffID 
			 join stf.Stuff stf on  sd.stuffid = stf.StuffID
			 join stf.StuffAccountGroup sag on sd.StuffAccountGroupID = sag.StuffAccountGroupID			
			LEFT JOIN stf.StuffAccountGroupPurchaseType sagpt
	    		ON  sagpt.StuffAccountGroupID = sag.StuffAccountGroupID
	    		AND sagpt.PurchaseTypeID = pi.Type
				

		

			union all
			 select cs.SlID,
					h.PrevoucherID,
					h.AdjustmentID,
					ai.AssetID,
					ai.BaseDocumentType,
					ai.Amount
			 from ast.Adjustmentitem ai
			 join #Adjustment h on h.AdjustmentID = ai.AdjustmentID
			 join cnt.ContractStatementItem csi on ai.BaseDocumentType = 3 and ai.BaseDocumentID = csi.ContractStatementItemID
			 join cnt.ContractSubject cs on cs.ContractSubjectID = csi.ContractSubjectID
		)A
		join ast.Asset b on a.AssetID = b.AssetID
		join [AST].[FnFindCategoryAccount]() c on c.AssetCategoryID = b.AssetCategoryID

		update a
		set ErrorMessage =  'معین کنترل دارایی در تنظیمات عمومی انتخاب نشده است.'+char(10)+char(13)
		from #Adjustment a
		join #Adjustmentitem b on a.AdjustmentID = b.AdjustmentID
		WHERE BaseDocumentType = 1 and @CreditSlID IS NULL

		update a
		set ErrorMessage = ErrorMessage + 'معین دارایی ثابت در برخی از گروههاانتخاب نشده است.'+char(10)+char(13)
		from #Adjustment a
		join #Adjustmentitem b on a.AdjustmentID = b.AdjustmentID
		join [AST].[FnFindCategoryAccount]() c on c.AssetCategoryID = b.AssetCategoryID		
		where c.FixAsset is null

		if exists (select * from #Adjustment where ErrorMessage is not null )
		BEGIN	
			select AdjustmentID,ErrorMessage from #Adjustment
			RETURN;
	    END

	    -- Insert Into PreVoucher Tabel
		set identity_insert [ACC].[PreVoucher] on	
	    INSERT INTO [ACC].[PreVoucher]([PreVoucherID],BranchID ,[DocumentNumtypeID],[Date],[FinancialPeriodID],[Description],[Description2],[Creator],[CreationDate],[LastEditor],[LastEditionDate],[Version])
		SELECT [PreVoucherID],BranchId,@DocumentNumTypeId,date,FinancialPeriodID,Description,Description2,@CreatorId,GETDATE(),@CreatorId,GETDATE(),0
		from #Adjustment
		set identity_insert [ACC].[PreVoucher] off
	    
	    UPDATE a
	    SET    PreVoucherID = b.PreVoucherId
		from ast.Adjustment a
		join #Adjustment b on a.AdjustmentID = b.AdjustmentID
	    


	    INSERT INTO ACC.PreVoucherItem (PreVoucherID ,RowIndex,SlID,DESCRIPTION , Description2,Debit,Credit,CurrencyID ,CurrencyRate, CurrencyDebit, CurrencyCredit,Creator,  CreationDate,LastEditor,LastEditionDate,Version)
		 SELECT PreVoucherId,1,case when Amount > 0 then FixAsset else SlID end,
				 case when Amount > 0 then AssetDescription else OpositSideDescription end,
				 case when Amount > 0 then AssetDescription2 else OpositSideDescription2 end,
				 abs(Amount),0,-1,1,abs(Amount),0,@CreatorId,GETDATE(),@CreatorId,GETDATE(),0
		 from #Adjustmentitem
			

	    INSERT INTO ACC.PreVoucherItem (PreVoucherID ,RowIndex,SlID,DESCRIPTION , Description2,Debit,Credit,CurrencyID ,CurrencyRate, CurrencyDebit, CurrencyCredit,Creator,  CreationDate,LastEditor,LastEditionDate,Version)
		 SELECT PreVoucherId,1,
				case when Amount < 0 then FixAsset else SlID end,
				case when Amount < 0 then OpositSideDescription else AssetDescription end,
				case when Amount < 0 then OpositSideDescription2 else AssetDescription2 end,
				0,abs(Amount),-1,1,0,abs(Amount),@CreatorId,GETDATE(),@CreatorId,GETDATE(),0
		 from #Adjustmentitem


		;with temp as 
		(
			select  [pi].PreVoucherItemID,
					ROW_NUMBER() over(partition by pi.PreVoucherID order by PreVoucherItemID) RowIndex,
					REPLACE(
					REPLACE(
					REPLACE(
						[pi].Description,
						'@@Number@@',i.Number),
						'@@Date_Gregorian@@',FullDateAlternateKey),
						'@@Date_Solar@@',PersianFullDateAlternateKey) [Description],
					REPLACE(
					REPLACE(
					REPLACE(
						[pi].Description2,
						'@@Number@@',i.Number),
						'@@Date_Gregorian@@',FullDateAlternateKey),
						'@@Date_Solar@@',PersianFullDateAlternateKey)[Description2]
			from #Adjustment i
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
					REPLACE(
						a.Description,
						'@@Number@@',b.Number),
						'@@Date_Gregorian@@',FullDateAlternateKey),
						'@@Date_Solar@@',PersianFullDateAlternateKey) ,
			[Description2] =
					REPLACE(
					REPLACE(
					REPLACE(
						a.Description2,
						'@@Number@@',b.Number),
						'@@Date_Gregorian@@',FullDateAlternateKey),
						'@@Date_Solar@@',PersianFullDateAlternateKey)
		from acc.PreVoucher a
		join #Adjustment b on a.PrevoucherID = b.PrevoucherID
