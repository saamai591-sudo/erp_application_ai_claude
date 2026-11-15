create  
PROCEDURE [AST].spSalePreVoucherInsert
	@SaleID NVARCHAR(MAX)
--WITH ENCRYPTION 
	 AS 

	    DECLARE @DocumentNumTypeId  INT = (SELECT DocumentNumTypeID  FROM   CFG.DocumentNumType  WHERE EngName = 'Sale'),
	            @MDEntity INT = (select Top 1 de.ID from mdt.DmdEntity AS de where de.Name = 'Sale'),
		        @HeaderDescription NVARCHAR(MAX),
				@HeaderDescription2 NVARCHAR(MAX),
	            @AssetDescription NVARCHAR(MAX),
				@AssetDescription2 NVARCHAR(MAX),
	            @CostDescription NVARCHAR(MAX),
				@CostDescription2 NVARCHAR(MAX),
		        @DepreciationDescription NVARCHAR(MAX),
				@DepreciationDescription2 NVARCHAR(MAX),
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
		FROM   cfg.R_FnCommaStr2Table(@SaleID) 	

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
	    SELECT  isnull(@MaxPrevoucherID,0) + ROW_NUMBER() over(order by a.SaleID) PrevoucherID,	
				a.SaleID,
			    a.FinancialPeriodID,
				a.Number,
				cast(null as varchar(max)) ErrorMessage,
				@HeaderDescription Description,
				@HeaderDescription2 Description2,
				a.Date,
				dd.FullDateAlternateKey,
				dd.PersianFullDateAlternateKey,
				fp.StartDate,
				a.BranchID
			into #Sale
	    FROM   AST.Sale a
		JOIN #DocumentIds b on a.SaleID = b.ID
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

		if exists (select * from #Sale where ErrorMessage is not null )
		BEGIN	
			select SaleID,ErrorMessage from #Sale
			RETURN;
	    END

		CREATE TABLE  #PreVoucherItemTemp
		(
			PreVoucherID INT null,
			SaleID INT null,
			SlID INT  null ,
			Debit DECIMAL(30,4)  null,
			Credit DECIMAL(30,4)  null ,
			[Description] nvarchar(max) null,
			Description2 nvarchar(max) null,
			SaleItemID INT null,
			AssetSettingID INT null,
			RowID INT IDENTITY(1,1) NOT NULL
		)

		insert into #PreVoucherItemTemp (PreVoucherID,SaleID,SlID,Debit,Credit,Description,Description2,SaleItemID)
		select  h.PrevoucherID,
				h.SaleID,
				 cat.AccumulatedDepreciation,
				case when a.Nature = 3 then isnull(aa.Depreciation , 0) else a.AccumulatedDepreciation + a.DuringDepreciation + isnull(aa.Depreciation , 0) end,
				0,
				REPLACE(@DepreciationDescription,
					'@@AssetTitle@@',a.Title),
				REPLACE(@DepreciationDescription2,
					'@@AssetTitle@@',a.Title2),
				si.SaleItemID
		from ast.SaleItem si
		join #Sale h on h.SaleID = si.SaleID
		join ast.Asset a on si.AssetID = a.AssetID
		left join #Depreciation aa on a.AssetID = aa.AssetID
		join [AST].[FnFindCategoryAccount]() cat on cat.AssetCategoryID = a.AssetCategoryID
		where a.DepreciationMethod <> 3
		and case when a.Nature = 3 then isnull(aa.Depreciation , 0) else a.AccumulatedDepreciation + a.DuringDepreciation + isnull(aa.Depreciation , 0) end > 0

		-- استهلاک تا تاریخ فروش که هنگام تایید فرم فروش محاسبه شده است
		-- ممکن است یک دارایی طی محاسبات استهلاک، چند AssetSettingID (و در نتیجه تفصیلی‌های متفاوت) داشته باشد
		-- پس به جای جمع کل و گرفتن یک تفصیلی، به ازای هر AssetSettingID یک ردیف جداگانه ساخته می‌شود
		select d.SaleID, d.AssetID, d.AssetSettingID, sum(d.Value) Value
		into #DepreciationBySetting
		from ast.Depreciation d
		where d.[Document] = 'Sale'
		group by d.SaleID, d.AssetID, d.AssetSettingID
		having sum(d.Value) > 0

		-- بدهکار: هزینه استهلاک
		insert into #PreVoucherItemTemp (PreVoucherID,SaleID,SlID,Debit,Credit,Description,Description2,SaleItemID,AssetSettingID)
		select  h.PrevoucherID,
				h.SaleID,
				cat.DepreciationCost,
				dd.Value,
				0,
				REPLACE(@DepreciationDescription,
					'@@AssetTitle@@',a.Title),
				REPLACE(@DepreciationDescription2,
					'@@AssetTitle@@',a.Title2),
				si.SaleItemID,
				dd.AssetSettingID
		from ast.SaleItem si
		join #Sale h on h.SaleID = si.SaleID
		join ast.Asset a on si.AssetID = a.AssetID
		join #DepreciationBySetting dd on dd.SaleID = si.SaleID and dd.AssetID = si.AssetID
		join [AST].[FnFindCategoryAccount]() cat on cat.AssetCategoryID = a.AssetCategoryID

		-- بستانکار: استهلاک انباشته
		insert into #PreVoucherItemTemp (PreVoucherID,SaleID,SlID,Debit,Credit,Description,Description2,SaleItemID,AssetSettingID)
		select  h.PrevoucherID,
				h.SaleID,
				cat.AccumulatedDepreciation,
				0,
				dd.Value,
				REPLACE(@DepreciationDescription,
					'@@AssetTitle@@',a.Title),
				REPLACE(@DepreciationDescription2,
					'@@AssetTitle@@',a.Title2),
				si.SaleItemID,
				dd.AssetSettingID
		from ast.SaleItem si
		join #Sale h on h.SaleID = si.SaleID
		join ast.Asset a on si.AssetID = a.AssetID
		join #DepreciationBySetting dd on dd.SaleID = si.SaleID and dd.AssetID = si.AssetID
		join [AST].[FnFindCategoryAccount]() cat on cat.AssetCategoryID = a.AssetCategoryID

		update a
		set ErrorMessage =  'در برخی از گروههای دارایی معین هزینه استهلاک تعیین نشده است.'+char(10)+char(13)
		from #Sale a
		join #PreVoucherItemTemp b on a.SaleID = b.SaleID
		join ast.SaleItem si on si.SaleItemID = b.SaleItemID
		join ast.Asset ass on ass.AssetID = si.AssetID
		join [AST].[FnFindCategoryAccount]() cat on cat.AssetCategoryID = ass.AssetCategoryID
		WHERE b.SlID IS NULL and cat.DepreciationCost is null
		update a
		set ErrorMessage =  isnull(ErrorMessage , '')+ 'در برخی از گروههای دارایی معین استهلاک انباشته تعیین نشده است.'+char(10)+char(13)
		from #Sale a
		join #PreVoucherItemTemp b on a.SaleID = b.SaleID
		WHERE b.SlID IS NULL

		if exists (select * from #Sale where ErrorMessage is not null )
		BEGIN	
			select SaleID,ErrorMessage from #Sale
			RETURN;
	    END

		insert into #PreVoucherItemTemp (PreVoucherID,SaleID,SlID,Debit,Credit,Description,Description2,SaleItemID)
		select  h.PrevoucherID,
				h.SaleID,
				case  s.Type  when  1 then cat.IncomeFromSale when  2 then cat.GiftCost end  ,
		 		v.value - (case when a.Nature = 3 then isnull(aa.Depreciation , 0) else a.AccumulatedDepreciation + a.DuringDepreciation + isnull(aa.Depreciation , 0) end),
				0,
				REPLACE(@CostDescription,
					'@@AssetTitle@@',a.Title),
				REPLACE(@CostDescription2,
					'@@AssetTitle@@',a.Title2),
				si.SaleItemID
		from ast.SaleItem si
		join #Sale h on h.SaleID = si.SaleID
		join ast.Sale s on s.SaleID = si.SaleID
		join ast.Asset a on si.AssetID = a.AssetID
		left join #Depreciation aa on a.AssetID = aa.AssetID
		join [AST].[FnFindCategoryAccount]() cat on cat.AssetCategoryID = a.AssetCategoryID
		join #AssetValue v on v.assetid = si.AssetID
		where v.value - (case when a.Nature = 3 then isnull(aa.Depreciation , 0) else a.AccumulatedDepreciation + a.DuringDepreciation + isnull(aa.Depreciation , 0) end) > 0


		update a
		set ErrorMessage =  'در برخی از گروههای دارایی معین سود و زیان ناشی از فروش و یا هزینه اهداء تعیین نشده است.'+char(10)+char(13)
		from #Sale a
		join #PreVoucherItemTemp b on a.SaleID = b.SaleID
		WHERE b.SlID IS NULL

		if exists (select * from #Sale where ErrorMessage is not null )
		BEGIN	
			select SaleID,ErrorMessage from #Sale
			RETURN;
	    END


		insert into #PreVoucherItemTemp (PreVoucherID,SaleID,SlID,Debit,Credit,Description,Description2,SaleItemID)
		select  h.PrevoucherID,
				h.SaleID,
				 cat.FixAsset,
				 0,
		 		v.value 	,
				REPLACE(@AssetDescription,
					'@@AssetTitle@@',a.Title),
				REPLACE(@AssetDescription2,
					'@@AssetTitle@@',a.Title2),
				si.SaleItemID
		from ast.SaleItem si
		join #Sale h on h.SaleID = si.SaleID
		join ast.Asset a on si.AssetID = a.AssetID
		join [AST].[FnFindCategoryAccount]() cat on cat.AssetCategoryID = a.AssetCategoryID
		join #AssetValue v on v.assetid = si.AssetID

		update a
		set ErrorMessage =   'در برخی از گروههای دارایی معین دارایی ثابت تعیین نشده است.'+char(10)+char(13)
		from #Sale a
		join #PreVoucherItemTemp b on a.SaleID = b.SaleID
		WHERE b.SlID IS NULL

		update a
		set ErrorMessage = ErrorMessage +   'تمامی ردیفهای ثبت شده در فروش دارایی شماره '+cast(a.Number as varchar(10))+ ' از نوع امحاء یا اسقاط بوده که فاقد سند حسابداری می باشند.'+char(10)+char(13)
		from #Sale a
		left join #PreVoucherItemTemp b on a.SaleID = b.SaleID
		WHERE b.SaleID IS NULL

		if exists (select * from #Sale where ErrorMessage is not null )
		BEGIN	
			select SaleID,ErrorMessage from #Sale
			RETURN;
	    END

	    -- Insert Into PreVoucher Tabel
		set identity_insert [ACC].[PreVoucher] on	
	    INSERT INTO [ACC].[PreVoucher](PreVoucherID,[BranchID],[DocumentNumtypeID],[Date],[FinancialPeriodID],[Description],[Description2],[Creator],[CreationDate],[LastEditor],[LastEditionDate],[Version])
		SELECT PreVoucherID,BranchID,@DocumentNumTypeId,date,FinancialPeriodID,Description,Description2,@CreatorId,GETDATE(),@CreatorId,GETDATE(),0
		from #Sale
		set identity_insert [ACC].[PreVoucher] off
	    
	    UPDATE a
	    SET    PreVoucherID = b.PreVoucherId
		from ast.Sale a
		join #Sale b on a.SaleID = b.SaleID
	    

		CREATE TABLE #ItemMap (RowID INT NOT NULL, PreVoucherItemID INT NOT NULL)

		MERGE ACC.PreVoucherItem AS tgt
		USING (select * from #PreVoucherItemTemp where Debit > 0) AS src
		ON 1 = 0
		WHEN NOT MATCHED THEN
			INSERT (PreVoucherID ,RowIndex,SlID,DESCRIPTION , Description2,Debit,Credit,CurrencyID ,CurrencyRate, CurrencyDebit, CurrencyCredit,Creator,  CreationDate,LastEditor,LastEditionDate,Version,BaseDocumentName,BaseDocumentID)
			VALUES (src.PreVoucherID,1,src.SlID,src.Description,src.Description2,src.Debit,0,-1,1,src.Debit,0,@CreatorId,GETDATE(),@CreatorId,GETDATE(),0,'SaleItem',src.SaleItemID)
		OUTPUT inserted.PreVoucherItemID, src.RowID INTO #ItemMap(PreVoucherItemID, RowID);

		-- Credit
		MERGE ACC.PreVoucherItem AS tgt
		USING (select * from #PreVoucherItemTemp where Credit > 0) AS src
		ON 1 = 0
		WHEN NOT MATCHED THEN
			INSERT (PreVoucherID ,RowIndex,SlID,DESCRIPTION , Description2,Debit,Credit,CurrencyID ,CurrencyRate, CurrencyDebit, CurrencyCredit,Creator,  CreationDate,LastEditor,LastEditionDate,Version,BaseDocumentName,BaseDocumentID)
			VALUES (src.PreVoucherID,1,src.SlID,src.Description,src.Description2,0,src.Credit,-1,1,0,src.Credit,@CreatorId,GETDATE(),@CreatorId,GETDATE(),0,'SaleItem',src.SaleItemID)
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
			from #Sale i
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
		join #Sale i on pi.PrevoucherID = i.PrevoucherID
