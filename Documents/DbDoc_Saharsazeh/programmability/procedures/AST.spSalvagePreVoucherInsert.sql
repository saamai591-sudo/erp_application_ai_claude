		
CREATE    PROCEDURE [AST].spSalvagePreVoucherInsert
	@SalvageId NVARCHAR(MAX)
--WITH ENCRYPTION 
	 AS 

	DECLARE @DocumentNumTypeId  INT = (SELECT DocumentNumTypeID  FROM   CFG.DocumentNumType  WHERE EngName = 'Salvage'),
	        @MDEntity INT = (select Top (1) de.ID from mdt.DmdEntity AS de where de.Name = 'Salvage'),
		    @HeaderDescription NVARCHAR(MAX),
			@HeaderDescription2 NVARCHAR(MAX),
	        @AssetDescription NVARCHAR(MAX),
			@AssetDescription2 NVARCHAR(MAX),
	        @CostDescription NVARCHAR(MAX),
			@CostDescription2 NVARCHAR(MAX),
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
		FROM   cfg.R_FnCommaStr2Table(@SalvageId)

		
		select  @HeaderDescription = Description,
				@HeaderDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'Header'

		select  @AssetDescription = Description,
				@AssetDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'Asset'

		select  @CostDescription = Description,
				@CostDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'Cost'   

		select  @DepreciationDescription = Description,
				@DepreciationDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'Depreciation'   
	    
		select @MaxPrevoucherID = MAX(PreVoucherID)
		from acc.PreVoucher
	    --- FetchValues ---
	    SELECT  isnull(@MaxPrevoucherID,0) + ROW_NUMBER() over(order by a.SalvageID) PrevoucherID,	
				a.SalvageID,
				a.FinancialPeriodID,
				cast(null as varchar(max)) ErrorMessage,
				@HeaderDescription Description,
				@HeaderDescription2 Description2,
				a.Date,
				a.BranchID,
				fp.StartDate,
				a.Number,
				dd.FullDateAlternateKey,
				dd.PersianFullDateAlternateKey
			into #Salvage
	    FROM   AST.Salvage a
		JOIN #DocumentIds b on a.SalvageID = b.ID
		JOIN cfg.DimDate DD on DD.Date = a.Date
		join cfg.FinancialPeriod fp on fp.FinancialPeriodID = a.FinancialPeriodID
	    WHERE a.PreVoucherID is null         

		select d.AssetID,sum(d.Value) Depreciation 
		into #Depreciation
			from ast.Depreciation d	
			group by d.AssetID


		
		select assetid,sum(value) value
		into #AssetValue
		from [AST].[VWAssetValue]
		group by assetid

		if exists (select * from #Salvage where ErrorMessage is not null )
		BEGIN	
			select SalvageID,ErrorMessage from #Salvage
			RETURN;
	    END
	
		CREATE TABLE  #PreVoucherItemTemp
		(
			PreVoucherID INT null,
			SalvageID int,
			SalvageItemID INT null,
			SlID INT  null ,
			Debit DECIMAL(30,4)  null,
			Credit DECIMAL(30,4)  null,
			Description nvarchar(max),
			Description2 nvarchar(max),
			AssetSettingID INT null,
			RowID INT IDENTITY(1,1) NOT NULL
		)

		insert into #PreVoucherItemTemp (PreVoucherID,SalvageID,SalvageItemID,SlID,Debit,Credit,Description,Description2)
		select  h.PrevoucherID,
				h.SalvageID,
				si.SalvageItemID,
				 cat.AccumulatedDepreciation,
				case when a.Nature = 3 then isnull(aa.Depreciation , 0) else a.AccumulatedDepreciation + a.DuringDepreciation + isnull(aa.Depreciation , 0) end,
				0,
				REPLACE(
				REPLACE(@DepreciationDescription,
					'@@Plaque@@',a.Plaque),
					'@@AssetTitle@@',a.Title),
				REPLACE(
				REPLACE(@DepreciationDescription2,
					'@@Plaque@@',a.Plaque),
					'@@AssetTitle@@',a.Title2)				
		from ast.SalvageItem si
		join #Salvage h on h.SalvageID = si.SalvageID
		join ast.Asset a on si.AssetID = a.AssetID
		left join #Depreciation aa on a.AssetID = aa.AssetID
		join [AST].[FnFindCategoryAccount]() cat on cat.AssetCategoryID = a.AssetCategoryID
		where a.DepreciationMethod <> 3
		and case when a.Nature = 3 then isnull(aa.Depreciation , 0) else a.AccumulatedDepreciation + a.DuringDepreciation + isnull(aa.Depreciation , 0) end > 0

		-- استهلاک تا تاریخ اسقاط که هنگام تایید فرم اسقاط محاسبه شده است
		-- ممکن است یک دارایی طی محاسبات استهلاک، چند AssetSettingID (و در نتیجه تفصیلی‌های متفاوت) داشته باشد
		-- پس به جای جمع کل و گرفتن یک تفصیلی، به ازای هر AssetSettingID یک ردیف جداگانه ساخته می‌شود
		select d.SalvageID, d.AssetID, d.AssetSettingID, sum(d.Value) Value
		into #DepreciationBySetting
		from ast.Depreciation d
		where d.[Document] = 'Salvage'
		group by d.SalvageID, d.AssetID, d.AssetSettingID
		having sum(d.Value) > 0

		-- بدهکار: هزینه استهلاک
		insert into #PreVoucherItemTemp (PreVoucherID,SalvageID,SalvageItemID,SlID,Debit,Credit,Description,Description2,AssetSettingID)
		select  h.PrevoucherID,
				h.SalvageID,
				si.SalvageItemID,
				cat.DepreciationCost,
				dd.Value,
				0,
				REPLACE(
				REPLACE(@DepreciationDescription,
					'@@Plaque@@',a.Plaque),
					'@@AssetTitle@@',a.Title),
				REPLACE(
				REPLACE(@DepreciationDescription2,
					'@@Plaque@@',a.Plaque),
					'@@AssetTitle@@',a.Title2),
				dd.AssetSettingID
		from ast.SalvageItem si
		join #Salvage h on h.SalvageID = si.SalvageID
		join ast.Asset a on si.AssetID = a.AssetID
		join #DepreciationBySetting dd on dd.SalvageID = si.SalvageID and dd.AssetID = si.AssetID
		join [AST].[FnFindCategoryAccount]() cat on cat.AssetCategoryID = a.AssetCategoryID

		-- بستانکار: استهلاک انباشته
		insert into #PreVoucherItemTemp (PreVoucherID,SalvageID,SalvageItemID,SlID,Debit,Credit,Description,Description2,AssetSettingID)
		select  h.PrevoucherID,
				h.SalvageID,
				si.SalvageItemID,
				cat.AccumulatedDepreciation,
				0,
				dd.Value,
				REPLACE(
				REPLACE(@DepreciationDescription,
					'@@Plaque@@',a.Plaque),
					'@@AssetTitle@@',a.Title),
				REPLACE(
				REPLACE(@DepreciationDescription2,
					'@@Plaque@@',a.Plaque),
					'@@AssetTitle@@',a.Title2),
				dd.AssetSettingID
		from ast.SalvageItem si
		join #Salvage h on h.SalvageID = si.SalvageID
		join ast.Asset a on si.AssetID = a.AssetID
		join #DepreciationBySetting dd on dd.SalvageID = si.SalvageID and dd.AssetID = si.AssetID
		join [AST].[FnFindCategoryAccount]() cat on cat.AssetCategoryID = a.AssetCategoryID

		update a
		set ErrorMessage =  'در برخی از گروههای دارایی معین هزینه استهلاک تعیین نشده است.'+char(10)+char(13)
		from #Salvage a
		join #PreVoucherItemTemp b on a.SalvageID = b.SalvageID
		join ast.SalvageItem si on si.SalvageItemID = b.SalvageItemID
		join ast.Asset ass on ass.AssetID = si.AssetID
		join [AST].[FnFindCategoryAccount]() cat on cat.AssetCategoryID = ass.AssetCategoryID
		WHERE b.SlID IS NULL and cat.DepreciationCost is null

		update a
		set ErrorMessage =  isnull(ErrorMessage , '')+ 'در برخی از گروههای دارایی معین استهلاک انباشته تعیین نشده است.'+char(10)+char(13)
		from #Salvage a
		join #PreVoucherItemTemp b on a.SalvageID = b.SalvageID
		WHERE b.SlID IS NULL

		if exists (select * from #Salvage where ErrorMessage is not null )
		BEGIN	
			select SalvageID,ErrorMessage from #Salvage
			RETURN;
	    END

		insert into #PreVoucherItemTemp (PreVoucherID,SalvageID,SalvageItemID,SlID,Debit,Credit,Description,Description2)
		select  h.PrevoucherID,
				h.SalvageID,
				si.SalvageItemID,
				cat.LossOfStopWorking,
		 		v.value - (case when a.Nature = 3 then isnull(aa.Depreciation , 0) else a.AccumulatedDepreciation + a.DuringDepreciation + isnull(aa.Depreciation , 0) end),
				0,
				REPLACE(
				REPLACE(@CostDescription,
					'@@Plaque@@',a.Plaque),
					'@@AssetTitle@@',a.Title),
				REPLACE(
				REPLACE(@CostDescription2,
					'@@Plaque@@',a.Plaque),
					'@@AssetTitle@@',a.Title2)
		from ast.SalvageItem si
		join #Salvage h on h.SalvageID = si.SalvageID
		join ast.Asset a on si.AssetID = a.AssetID
		left join #Depreciation aa on a.AssetID = aa.AssetID
		join [AST].[FnFindCategoryAccount]() cat on cat.AssetCategoryID = a.AssetCategoryID
		join #AssetValue v on v.AssetID = si.AssetID
		where v.value - (case when a.Nature = 3 then isnull(aa.Depreciation , 0) else a.AccumulatedDepreciation + a.DuringDepreciation + isnull(aa.Depreciation , 0) end) > 0

		update a
		set ErrorMessage =  'در برخی از گروه حسابهای انتخاب شده معین زیان ناشی از فرسودگی وارد نشده است.' + char(10)+char(13)
		from #Salvage a
		join #PreVoucherItemTemp b on a.SalvageID = b.SalvageID
		WHERE b.SlID IS NULL

		if exists (select * from #Salvage where ErrorMessage is not null )
		BEGIN	
			select SalvageID,ErrorMessage from #Salvage
			RETURN;
	    END

		insert into #PreVoucherItemTemp (PreVoucherID,SalvageID,SalvageItemID,SlID,Debit,Credit,Description,Description2)
		select  h.PrevoucherID,
				h.SalvageID,
				si.SalvageItemID,
				 cat.FixAsset,
		 		0,
				v.value,
				REPLACE(
				REPLACE(@AssetDescription,
					'@@Plaque@@',a.Plaque),
					'@@AssetTitle@@',a.Title),
				REPLACE(
				REPLACE(@AssetDescription2,
					'@@Plaque@@',a.Plaque),
					'@@AssetTitle@@',a.Title2)	
		from ast.SalvageItem si
		join #Salvage h on h.SalvageID = si.SalvageID
		join ast.Asset a on si.AssetID = a.AssetID
		join [AST].[FnFindCategoryAccount]() cat on cat.AssetCategoryID = a.AssetCategoryID
		join #AssetValue v on v.AssetID = si.AssetID

		update a
		set ErrorMessage =  'در برخی از گروه حسابهای انتخاب شده معین دارایی ثابت وارد نشده است.'+ char(10)+char(13)
		from #Salvage a
		join #PreVoucherItemTemp b on a.SalvageID = b.SalvageID
		WHERE b.SlID IS NULL

		if exists (select * from #Salvage where ErrorMessage is not null )
		BEGIN	
			select SalvageID,ErrorMessage from #Salvage
			RETURN;
	    END

	    -- Insert Into PreVoucher Tabel
		set identity_insert [ACC].[PreVoucher] on	
	    INSERT INTO [ACC].[PreVoucher](PreVoucherID,[BranchID],[DocumentNumtypeID],[Date],[FinancialPeriodID],[Description],[Description2],[Creator],[CreationDate],[LastEditor],[LastEditionDate],[Version])
		SELECT PreVoucherID,BranchID,@DocumentNumTypeId,date,FinancialPeriodID,Description,Description2,@CreatorId,GETDATE(),@CreatorId,GETDATE(),0
		from #Salvage
		set identity_insert [ACC].[PreVoucher] off
	    
	    UPDATE a
	    SET    PreVoucherID = b.PreVoucherId
		from ast.Salvage a
		join #Salvage b on a.SalvageID = b.SalvageID
	    	    
		CREATE TABLE #ItemMap (RowID INT NOT NULL, PreVoucherItemID INT NOT NULL)

		MERGE ACC.PreVoucherItem AS tgt
		USING (select * from #PreVoucherItemTemp where Debit > 0) AS src
		ON 1 = 0
		WHEN NOT MATCHED THEN
			INSERT (PreVoucherID ,RowIndex,SlID,DESCRIPTION , Description2,Debit,Credit,CurrencyID ,CurrencyRate, CurrencyDebit, CurrencyCredit,Creator,  CreationDate,LastEditor,LastEditionDate,Version,BaseDocumentName,BaseDocumentID)
			VALUES (src.PreVoucherID,1,src.SlID,src.Description,src.Description2,src.Debit,0,-1,1,src.Debit,0,@CreatorId,GETDATE(),@CreatorId,GETDATE(),0,'SalvageItem',src.SalvageItemID)
		OUTPUT inserted.PreVoucherItemID, src.RowID INTO #ItemMap(PreVoucherItemID, RowID);

		MERGE ACC.PreVoucherItem AS tgt
		USING (select * from #PreVoucherItemTemp where Credit > 0) AS src
		ON 1 = 0
		WHEN NOT MATCHED THEN
			INSERT (PreVoucherID ,RowIndex,SlID,DESCRIPTION , Description2,Debit,Credit,CurrencyID ,CurrencyRate, CurrencyDebit, CurrencyCredit,Creator,  CreationDate,LastEditor,LastEditionDate,Version,BaseDocumentName,BaseDocumentID)
			VALUES (src.PreVoucherID,1,src.SlID,src.Description,src.Description2,0,src.Credit,-1,1,0,src.Credit,@CreatorId,GETDATE(),@CreatorId,GETDATE(),0,'SalvageItem',src.SalvageItemID)
		OUTPUT inserted.PreVoucherItemID, src.RowID INTO #ItemMap(PreVoucherItemID, RowID);

		-- تفصیلی ردیف‌های استهلاک (هزینه استهلاک و استهلاک انباشته)؛ به ازای AssetSettingID دقیق همان محاسبه استهلاک
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
		FROM #PreVoucherItemTemp t
		join #ItemMap im on im.RowID = t.RowID
		join Acc.AccountLevelSL a on a.SlID = t.SlID
		join ast.AssetSettingDl d on d.AssetSettingID = t.AssetSettingID and d.DlTypeID = a.DlTypeID
		where t.AssetSettingID is not null
		group by im.PreVoucherItemID,a.AccountLevelID,d.DlID

		;with temp as 
		(
			select  [pi].PreVoucherItemID,
					ROW_NUMBER() over(partition by pi.PreVoucherID order by pi.PreVoucherItemID) RowIndex,
					REPLACE(
					REPLACE(
					REPLACE(
						[pi].Description,
						'@@Number@@',i.Number),
						'@@Date_Gregorian@@',i.FullDateAlternateKey),
						'@@Date_Solar@@',i.PersianFullDateAlternateKey) [Description],
					REPLACE(
					REPLACE(
					REPLACE(
						[pi].Description2,
						'@@Number@@',i.Number),
						'@@Date_Gregorian@@',i.FullDateAlternateKey),
						'@@Date_Solar@@',i.PersianFullDateAlternateKey)[Description2]
			from #Salvage i
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
						'@@Number@@',i.Number),
						'@@Date_Gregorian@@',i.FullDateAlternateKey),
						'@@Date_Solar@@',i.PersianFullDateAlternateKey)		
		,
			[Description2] =
					REPLACE(
					REPLACE(
					REPLACE(
						[pi].Description2,
						'@@Number@@',i.Number),
						'@@Date_Gregorian@@',i.FullDateAlternateKey),
						'@@Date_Solar@@',i.PersianFullDateAlternateKey)
		from acc.PreVoucher pi
		join #Salvage i on pi.PrevoucherID = i.PrevoucherID
