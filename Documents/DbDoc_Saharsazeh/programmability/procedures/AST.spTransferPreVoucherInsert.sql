		CREATE  
PROCEDURE [AST].spTransferPreVoucherInsert
	@TransferID NVARCHAR(MAX)
--WITH ENCRYPTION 
	 AS 

	    DECLARE @DocumentNumTypeId  INT = (SELECT DocumentNumTypeID  FROM   CFG.DocumentNumType  WHERE EngName = 'Transfer'),
	            @MDEntity INT = (select Top 1 Id from mdt.DmdEntity AS de where de.Name = 'Transfer'),
		        @HeaderDescription NVARCHAR(MAX),
				@HeaderDescription2 NVARCHAR(MAX),
	            @AssetDescription NVARCHAR(MAX),
				@AssetDescription2 NVARCHAR(MAX),
	            @TransferDescription NVARCHAR(MAX),
				@TransferDescription2 NVARCHAR(MAX),
		        @DepreciationDescription NVARCHAR(MAX),
				@DepreciationDescription2 NVARCHAR(MAX),
				@MaxPrevoucherID int,
				@CreatorId int,
				@Culture VARCHAR(10),
				@CultureNo TinyInt
	        
		set @CreatorId = cfg.GetuserID();
		SET @Culture = CFG.GetuserCulture();

		select @CultureNo = CultureNo
		from cfg.CultureInfo
		where Culture = @Culture;

		SELECT [value] ID
		INTO #DocumentIds
		FROM   cfg.R_FnCommaStr2Table(@TransferID) 	

		select  @HeaderDescription = Description,
				@HeaderDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'Header'

		select  @AssetDescription = Description,
				@AssetDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'Asset'

		select  @TransferDescription = Description,
				@TransferDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'Transfer'   

		select  @DepreciationDescription = Description,
				@DepreciationDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'Depreciation'   
	  	    
		select @MaxPrevoucherID = MAX(PreVoucherID)
		from acc.PreVoucher
	    --- FetchValues ---
	    SELECT  isnull(@MaxPrevoucherID,0) + ROW_NUMBER() over(order by c.TransferID) PrevoucherID,	
				c.TransferID,
				c.FinancialPeriodID,
				cast(null as varchar(max)) ErrorMessage,
				@HeaderDescription Description,
				@HeaderDescription2 Description2,
				c.date,
				c.SourceBranchID,
				b.Title,
				fp.StartDate,
				c.Number,
				dd.FullDateAlternateKey,
				dd.PersianFullDateAlternateKey,
				b.Title SourceBranchTitle,
				b.Title2 SourceBranchTitle2,
				b2.Title DestinationBranchTitle,
				b2.Title2 DestinationBranchTitle2
			into #Transfer
	    FROM   AST.Transfer c		
		join cfg.Branch b on b.BranchID = c.SourceBranchID
		join cfg.Branch b2 on b2.BranchID = c.DestinationBranchID
		JOIN #DocumentIds di on c.TransferID = di.ID
		JOIN cfg.DimDate DD on DD.Date = c.Date
		join cfg.FinancialPeriod fp on fp.FinancialPeriodID = c.FinancialPeriodID
	    WHERE c.PreVoucherID is null 

		-- Resolve header description placeholders before inserting PreVoucher
		UPDATE t
		SET [Description] =
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
						ISNULL(t.[Description], N''),
						N'@@DestinationBranch@@', ISNULL(t.DestinationBranchTitle, N'')),
						N'@@SourceBranch@@', ISNULL(t.SourceBranchTitle, N'')),
						N'@@Number@@', ISNULL(CAST(t.Number AS NVARCHAR(50)), N'')),
						N'@@Date_Gregorian@@', ISNULL(t.FullDateAlternateKey, N'')),
						N'@@Date_Solar@@', ISNULL(t.PersianFullDateAlternateKey, N'')),
			[Description2] =
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
						ISNULL(t.[Description2], N''),
						N'@@DestinationBranch@@', ISNULL(t.DestinationBranchTitle2, N'')),
						N'@@SourceBranch@@', ISNULL(t.SourceBranchTitle2, N'')),
						N'@@Number@@', ISNULL(CAST(t.Number AS NVARCHAR(50)), N'')),
						N'@@Date_Gregorian@@', ISNULL(t.FullDateAlternateKey, N'')),
						N'@@Date_Solar@@', ISNULL(t.PersianFullDateAlternateKey, N''))
		FROM #Transfer t
  
		select d.AssetID,sum(d.Value) Depreciation 
		into #Depreciation
		from ast.Depreciation d	
		group by d.AssetID

		select assetid,sum(value) value
		into #AssetValue
		from [AST].[VWAssetValue]
		group by assetid

		select  h.PrevoucherID,
				h.TransferID,
				v.Value,
				case when a.Nature = 3 then isnull(d.Depreciation,0)
				else a.AccumulatedDepreciation + a.DuringDepreciation + isnull(d.Depreciation,0) end Depreciation,
				REPLACE(
				REPLACE(@AssetDescription,
					'@@Plaque@@',a.Plaque),
					'@@AssetTitle@@',a.Title) AssetDescription,
			 	REPLACE(
				REPLACE(@AssetDescription2,
					'@@Plaque@@',a.Plaque),
					'@@AssetTitle@@',a.Title2) AssetDescription2,
				REPLACE(
				REPLACE(@DepreciationDescription,
					'@@Plaque@@',a.Plaque),
					'@@AssetTitle@@',a.Title) DepreciationDescription,
			 	REPLACE(
				REPLACE(@DepreciationDescription2,
					'@@Plaque@@',a.Plaque),
					'@@AssetTitle@@',a.Title2) DepreciationDescription2,
				REPLACE(
				REPLACE(@TransferDescription,
					'@@Plaque@@',a.Plaque),
					'@@AssetTitle@@',a.Title) TransferDescription,
			 	REPLACE(
				REPLACE(@TransferDescription2,
					'@@Plaque@@',a.Plaque),
					'@@AssetTitle@@',a.Title2) TransferDescription2,
				cat.AccumulatedDepreciation AccumulatedDepreciationSlID,
				[TransfersBetweenBranches],
				[FixAsset]
			, ai.TransferItemID,
					cat.DepreciationCost DepreciationCostSlID,
					isnull(td.Value,0) TransferDepreciation
				into #TransferItem
		 from ast.TransferItem ai
		 join #Transfer h on h.TransferID = ai.TransferID
		 join ast.Asset a on a.AssetID = ai.AssetID
		 left join #Depreciation d on d.AssetID = ai.AssetID
		 join [AST].[FnFindCategoryAccount]() cat on cat.AssetCategoryID = a.AssetCategoryID
		 join #AssetValue v on v.AssetID = ai.AssetID
			 left join
			 (
				select d2.TransferID, d2.AssetID, sum(d2.Value) Value
				from ast.Depreciation d2
				where d2.[Document] = 'Transfer'
				group by d2.TransferID, d2.AssetID
			 ) td on td.TransferID = ai.TransferID and td.AssetID = ai.AssetID

		-- ممکن است یک دارایی طی محاسبات استهلاک این انتقال، چند AssetSettingID (و در نتیجه تفصیلی‌های متفاوت) داشته باشد
		-- پس به جای یک ردیف جمع‌شده با یک تفصیلی، به ازای هر AssetSettingID یک ردیف جداگانه نگه‌داری می‌شود
		select ai.TransferItemID, dd.AssetSettingID, dd.Value
		into #TransferDepreciationBySetting
		from ast.TransferItem ai
		join
		(
			select d2.TransferID, d2.AssetID, d2.AssetSettingID, sum(d2.Value) Value
			from ast.Depreciation d2
			where d2.[Document] = 'Transfer'
			group by d2.TransferID, d2.AssetID, d2.AssetSettingID
			having sum(d2.Value) > 0
		) dd on dd.TransferID = ai.TransferID and dd.AssetID = ai.AssetID

		update a
		set ErrorMessage =  isnull(ErrorMessage , '')+ 'معین هزینه استهلاک در برخی از گروهها انتخاب نشده است.' + char(10)+char(13)
		from #Transfer a
		join #TransferItem b on a.TransferID = b.TransferID
		WHERE b.DepreciationCostSlID IS NULL and b.TransferDepreciation > 0

		update a
		set ErrorMessage =  isnull(ErrorMessage , '')+ 'معین دارایی ثابت در برخی از گروهها انتخاب نشده است.' + char(10)+char(13)
		from #Transfer a
		join #TransferItem b on a.TransferID = b.TransferID
		WHERE b.FixAsset IS NULL

		update a
		set ErrorMessage =  isnull(ErrorMessage , '')+ 'معین استهلاک انباشته در برخی از گروهها انتخاب نشده است.' + char(10)+char(13)
		from #Transfer a
		join #TransferItem b on a.TransferID = b.TransferID
		WHERE b.AccumulatedDepreciationSlID IS NULL and Depreciation <> 0

		update a
		set ErrorMessage =  isnull(ErrorMessage , '')+  'معین نقل و انتقالات بین شعب در برخی از گروهها انتخاب نشده است.'+ char(10)+char(13)
		from #Transfer a
		join #TransferItem b on a.TransferID = b.TransferID
		WHERE b.[TransfersBetweenBranches] IS NULL 


		if exists (select * from #Transfer where ErrorMessage is not null )
		BEGIN	
			select TransferID,ErrorMessage from #Transfer
			RETURN;
	    END
		
	    -- Insert Into PreVoucher Tabel
		set identity_insert [ACC].[PreVoucher] on	
	    INSERT INTO [ACC].[PreVoucher](PreVoucherID,BranchID ,[DocumentNumtypeID],[Date],[FinancialPeriodID],[Description],[Description2],[Creator],[CreationDate],[LastEditor],[LastEditionDate],[Version])
		SELECT PreVoucherID,SourceBranchID,@DocumentNumTypeId,date,FinancialPeriodID,Description,Description2,@CreatorId,GETDATE(),@CreatorId,GETDATE(),0
		from #Transfer
		set identity_insert [ACC].[PreVoucher] off
	    
	    UPDATE a
	    SET    PreVoucherID = b.PreVoucherId
		from ast.Transfer a
		join #Transfer b on a.TransferID = b.TransferID
	    
	    INSERT INTO ACC.PreVoucherItem (PreVoucherID ,RowIndex,SlID,DESCRIPTION , Description2,Debit,Credit,CurrencyID ,CurrencyRate, CurrencyDebit, CurrencyCredit,Creator,  CreationDate,LastEditor,LastEditionDate,Version,BaseDocumentName,BaseDocumentID)
		 SELECT PreVoucherId,
				1,
				AccumulatedDepreciationSlID,
				DepreciationDescription,
				DepreciationDescription2,
				Depreciation,
				0,
				-1,1,
				Depreciation,
				0,
				@CreatorId,GETDATE(),@CreatorId,GETDATE(),0,'TransferItem',TransferItemID
		 from #TransferItem ai
		 where  Depreciation > 0

		-- استهلاک تا تاریخ انتقال که هنگام تایید فرم انتقال محاسبه شده است
		CREATE TABLE #ItemMap (PreVoucherItemID INT NOT NULL, TransferItemID INT NOT NULL, AssetSettingID INT NOT NULL, SlID INT NOT NULL)

		-- بدهکار: هزینه استهلاک
		MERGE ACC.PreVoucherItem AS tgt
		USING
		(
			select ti.PreVoucherId, ti.DepreciationCostSlID SlID, ti.DepreciationDescription, ti.DepreciationDescription2, ds.Value, ti.TransferItemID, ds.AssetSettingID
			from #TransferItem ti
			join #TransferDepreciationBySetting ds on ds.TransferItemID = ti.TransferItemID
		) AS src
		ON 1 = 0
		WHEN NOT MATCHED THEN
			INSERT (PreVoucherID ,RowIndex,SlID,DESCRIPTION , Description2,Debit,Credit,CurrencyID ,CurrencyRate, CurrencyDebit, CurrencyCredit,Creator,  CreationDate,LastEditor,LastEditionDate,Version,BaseDocumentName,BaseDocumentID)
			VALUES (src.PreVoucherId,1,src.SlID,src.DepreciationDescription,src.DepreciationDescription2,src.Value,0,-1,1,src.Value,0,@CreatorId,GETDATE(),@CreatorId,GETDATE(),0,'TransferItem',src.TransferItemID)
		OUTPUT inserted.PreVoucherItemID, src.TransferItemID, src.AssetSettingID, src.SlID INTO #ItemMap(PreVoucherItemID, TransferItemID, AssetSettingID, SlID);


	    INSERT INTO ACC.PreVoucherItem (PreVoucherID ,RowIndex,SlID,DESCRIPTION , Description2,Debit,Credit,CurrencyID ,CurrencyRate, CurrencyDebit, CurrencyCredit,Creator,  CreationDate,LastEditor,LastEditionDate,Version,BaseDocumentName,BaseDocumentID)
		 SELECT PreVoucherId,
				1,
				[TransfersBetweenBranches],
				TransferDescription,
				TransferDescription2,
				Value - Depreciation,
				0,
				-1,1,
			    Value - Depreciation,
				0,
				@CreatorId,GETDATE(),@CreatorId,GETDATE(),0,'TransferItem',TransferItemID
		 from #TransferItem ai
		where Value - Depreciation > 0

	
	    INSERT INTO ACC.PreVoucherItem (PreVoucherID ,RowIndex,SlID,DESCRIPTION , Description2,Debit,Credit,CurrencyID ,CurrencyRate, CurrencyDebit, CurrencyCredit,Creator,  CreationDate,LastEditor,LastEditionDate,Version,BaseDocumentName,BaseDocumentID)
		 SELECT PreVoucherId,
				1,
				[FixAsset],
				AssetDescription,
				AssetDescription2,
				0,
				Value,
				-1,1,
				0,
			    Value,
				@CreatorId,GETDATE(),@CreatorId,GETDATE(),0,'TransferItem',TransferItemID
		 from #TransferItem ai


				-- بستانکار: استهلاک انباشته
		MERGE ACC.PreVoucherItem AS tgt
		USING
		(
			select ti.PreVoucherId, ti.AccumulatedDepreciationSlID SlID, ti.DepreciationDescription, ti.DepreciationDescription2, ds.Value, ti.TransferItemID, ds.AssetSettingID
			from #TransferItem ti
			join #TransferDepreciationBySetting ds on ds.TransferItemID = ti.TransferItemID
		) AS src
		ON 1 = 0
		WHEN NOT MATCHED THEN
			INSERT (PreVoucherID ,RowIndex,SlID,DESCRIPTION , Description2,Debit,Credit,CurrencyID ,CurrencyRate, CurrencyDebit, CurrencyCredit,Creator,  CreationDate,LastEditor,LastEditionDate,Version,BaseDocumentName,BaseDocumentID)
			VALUES (src.PreVoucherId,1,src.SlID,src.DepreciationDescription,src.DepreciationDescription2,0,src.Value,-1,1,0,src.Value,@CreatorId,GETDATE(),@CreatorId,GETDATE(),0,'TransferItem',src.TransferItemID)
		OUTPUT inserted.PreVoucherItemID, src.TransferItemID, src.AssetSettingID, src.SlID INTO #ItemMap(PreVoucherItemID, TransferItemID, AssetSettingID, SlID);

		-- تفصیلی ردیف‌های استهلاک؛ به ازای AssetSettingID دقیق همان محاسبه استهلاک
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
		SELECT
			im.PreVoucherItemID,
			a.AccountLevelID,
			d.DlID,
			NULL,
			@CreatorId,
			GETDATE(),
			@CreatorId,
			GETDATE(),
			0
		FROM #ItemMap im
		join Acc.AccountLevelSL a on a.SlID = im.SlID
		join ast.AssetSettingDl d on d.AssetSettingID = im.AssetSettingID and d.DlTypeID = a.DlTypeID
		group by im.PreVoucherItemID,a.AccountLevelID,d.DlID

;with temp as 
		(
			select  [pi].PreVoucherItemID,
					ROW_NUMBER() over(partition by pi.PreVoucherID order by pi.PreVoucherItemID) RowIndex,
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
						ISNULL([pi].Description, N''),
						N'@@DestinationBranch@@', ISNULL(i.DestinationBranchTitle, N'')),
						N'@@SourceBranch@@', ISNULL(i.SourceBranchTitle, N'')),
						N'@@Number@@', ISNULL(CAST(i.Number AS NVARCHAR(50)), N'')),
						N'@@Date_Gregorian@@', ISNULL(i.FullDateAlternateKey, N'')),
						N'@@Date_Solar@@', ISNULL(i.PersianFullDateAlternateKey, N'')) [Description],
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
						ISNULL([pi].Description2, N''),
						N'@@DestinationBranch@@', ISNULL(i.DestinationBranchTitle2, N'')),
						N'@@SourceBranch@@', ISNULL(i.SourceBranchTitle2, N'')),
						N'@@Number@@', ISNULL(CAST(i.Number AS NVARCHAR(50)), N'')),
						N'@@Date_Gregorian@@', ISNULL(i.FullDateAlternateKey, N'')),
						N'@@Date_Solar@@', ISNULL(i.PersianFullDateAlternateKey, N''))[Description2]
			from #Transfer i
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
					REPLACE(
						ISNULL([pi].Description, N''),
						N'@@DestinationBranch@@', ISNULL(i.DestinationBranchTitle, N'')),
						N'@@SourceBranch@@', ISNULL(i.SourceBranchTitle, N'')),
						N'@@Number@@', ISNULL(CAST(i.Number AS NVARCHAR(50)), N'')),
						N'@@Date_Gregorian@@', ISNULL(i.FullDateAlternateKey, N'')),
						N'@@Date_Solar@@', ISNULL(i.PersianFullDateAlternateKey, N'')) 		
		,
			[Description2] =
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
						ISNULL([pi].Description2, N''),
						N'@@DestinationBranch@@', ISNULL(i.DestinationBranchTitle2, N'')),
						N'@@SourceBranch@@', ISNULL(i.SourceBranchTitle2, N'')),
						N'@@Number@@', ISNULL(CAST(i.Number AS NVARCHAR(50)), N'')),
						N'@@Date_Gregorian@@', ISNULL(i.FullDateAlternateKey, N'')),
						N'@@Date_Solar@@', ISNULL(i.PersianFullDateAlternateKey, N''))
		from acc.PreVoucher pi
		join #Transfer i on pi.PrevoucherID = i.PrevoucherID

