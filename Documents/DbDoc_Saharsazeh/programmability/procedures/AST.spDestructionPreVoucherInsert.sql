		CREATE     PROCEDURE [AST].spDestructionPreVoucherInsert
	@DestructionID NVARCHAR(MAX)
--WITH ENCRYPTION 
	 AS 

	    DECLARE @DocumentNumTypeId  INT = (SELECT DocumentNumTypeID  FROM   CFG.DocumentNumType  WHERE EngName = 'Destruction'),
	            @MDEntity INT = (select Top 1 de.ID from mdt.DmdEntity AS de where de.[Name] = 'Destruction'),
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
		FROM   cfg.R_FnCommaStr2Table(@DestructionID)



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
	    SELECT  isnull(@MaxPrevoucherID,0) + ROW_NUMBER() over(order by a.DestructionID) PrevoucherID,	
				a.DestructionID,
			    a.FinancialPeriodID,
				cast(null as varchar(max)) ErrorMessage,
				@HeaderDescription Description,
				@HeaderDescription2 Description2,
				a.DATE,
				dr.LossFromDisaster,
				dr.Title DestructionReasonTitle,
				dr.Title2 DestructionReasonTitle2,
				fp.StartDate,
				a.BranchID,
				DD.FullDateAlternateKey,
				DD.PersianFullDateAlternateKey,
				a.Number
			into #Destruction
	    FROM   AST.Destruction a
	    JOIN ast.DestructionReason AS dr ON dr.DestructionReasonID = a.DestructionReasonID
		JOIN #DocumentIds b on a.DestructionID = b.ID
		JOIN cfg.DimDate DD on DD.Date = a.Date
		join cfg.FinancialPeriod fp on fp.FinancialPeriodID = a.FinancialPeriodID
	    WHERE a.PreVoucherID is null      
	    
		select d.AssetID,sum(d.Value) Depreciation 
		into #Depreciation
		from ast.Depreciation d		
		group by d.AssetID

		update a
		set ErrorMessage =  'در علت خروج '+DestructionReasonTitle+' مقدار معین زیان ناشی از حوادث غیر مترقبه وارد نشده است.'+char(10)+char(13)
		from #Destruction a
		WHERE LossFromDisaster IS NULL

		update a
		set ErrorMessage =  isnull(a.ErrorMessage,'')+ 'برای داراییهای زیر گروه دارایی انتخاب نشده است: '+ass.Title+char(10)+char(13)
		from #Destruction a
		join ast.DestructionItem si on a.DestructionID = si.DestructionID
		join ast.Asset ass on si.AssetID = ass.AssetID
		left join ast.AssetCategory ac on ac.AssetCategoryID = ass.AssetCategoryID
		where  ac.AssetCategoryID is null


		
		select assetid,sum(value) value
		into #AssetValue
		from [AST].[VWAssetValue]
		group by assetid




		if exists (select * from #Destruction where ErrorMessage is not null )
		BEGIN	
			select DestructionID,ErrorMessage from #Destruction
			RETURN;
	    END

	
		CREATE TABLE  #PreVoucherItemTemp
		(
			PreVoucherID INT null,
			DestructionItemID INT null,
			SlID INT  null ,
			Debit DECIMAL(30,4)  null,
			Credit DECIMAL(30,4)  null,
			AssetID INT NULL,
			Description nvarchar(max) NULL ,
			Description2 nvarchar(max) NULL ,
			DestructionID INT null,
			AssetSettingID INT null,
			RowID INT IDENTITY(1,1) NOT NULL
		)

		insert into #PreVoucherItemTemp (PreVoucherID,DestructionItemID,SlID,Debit,Credit,AssetID,Description,Description2,DestructionID)
		select  h.PrevoucherID,
				si.DestructionItemID,
				cat.AccumulatedDepreciation,
				case when a.Nature = 3 then isnull(aa.Depreciation , 0)
				else a.AccumulatedDepreciation + a.DuringDepreciation + isnull(aa.Depreciation , 0) end,
				0,
				si.AssetID,
				REPLACE(
				REPLACE(@DepreciationDescription,
					'@@Plaque@@',isnull(a.Plaque,'')),
					'@@AssetTitle@@',a.Title),
				REPLACE(
				REPLACE(@DepreciationDescription2,
					'@@Plaque@@',isnull(a.Plaque,'')),
					'@@AssetTitle@@',a.Title2),
				si.DestructionID
		from ast.DestructionItem si
		join #Destruction h on h.DestructionID = si.DestructionID
		join ast.Asset a on si.AssetID = a.AssetID
		left join #Depreciation aa on a.AssetID = aa.AssetID
		join [AST].[FnFindCategoryAccount]() cat on cat.AssetCategoryID = a.AssetCategoryID
		where a.DepreciationMethod <> 3
		and case when a.Nature = 3 then isnull(aa.Depreciation , 0)
				else a.AccumulatedDepreciation + a.DuringDepreciation + isnull(aa.Depreciation , 0) end > 0

		

		-- استهلاک تا تاریخ خروج که هنگام تایید فرم خروج محاسبه شده است
		-- ممکن است یک دارایی طی محاسبات استهلاک، چند AssetSettingID (و در نتیجه تفصیلی‌های متفاوت) داشته باشد
		-- پس به جای جمع کل و گرفتن یک تفصیلی، به ازای هر AssetSettingID یک ردیف جداگانه ساخته می‌شود
		select d.DestructionID, d.AssetID, d.AssetSettingID, sum(d.Value) Value
		into #DepreciationBySetting
		from ast.Depreciation d
		where d.[Document] = 'Destruction'
		group by d.DestructionID, d.AssetID, d.AssetSettingID
		having sum(d.Value) > 0

		-- بدهکار: هزینه استهلاک
		insert into #PreVoucherItemTemp (PreVoucherID,DestructionItemID,SlID,Debit,Credit,AssetID,Description,Description2,DestructionID,AssetSettingID)
		select  h.PrevoucherID,
				si.DestructionItemID,
				cat.DepreciationCost,
				dd.Value,
				0,
				si.AssetID,
				REPLACE(
				REPLACE(@DepreciationDescription,
					'@@Plaque@@',isnull(a.Plaque,'')),
					'@@AssetTitle@@',a.Title),
				REPLACE(
				REPLACE(@DepreciationDescription2,
					'@@Plaque@@',isnull(a.Plaque,'')),
					'@@AssetTitle@@',a.Title2),
				si.DestructionID,
				dd.AssetSettingID
		from ast.DestructionItem si
		join #Destruction h on h.DestructionID = si.DestructionID
		join ast.Asset a on si.AssetID = a.AssetID
		join #DepreciationBySetting dd on dd.DestructionID = si.DestructionID and dd.AssetID = si.AssetID
		join [AST].[FnFindCategoryAccount]() cat on cat.AssetCategoryID = a.AssetCategoryID

		-- بستانکار: استهلاک انباشته
		insert into #PreVoucherItemTemp (PreVoucherID,DestructionItemID,SlID,Debit,Credit,AssetID,Description,Description2,DestructionID,AssetSettingID)
		select  h.PrevoucherID,
				si.DestructionItemID,
				cat.AccumulatedDepreciation,
				0,
				dd.Value,
				si.AssetID,
				REPLACE(
				REPLACE(@DepreciationDescription,
					'@@Plaque@@',isnull(a.Plaque,'')),
					'@@AssetTitle@@',a.Title),
				REPLACE(
				REPLACE(@DepreciationDescription2,
					'@@Plaque@@',isnull(a.Plaque,'')),
					'@@AssetTitle@@',a.Title2),
				si.DestructionID,
				dd.AssetSettingID
		from ast.DestructionItem si
		join #Destruction h on h.DestructionID = si.DestructionID
		join ast.Asset a on si.AssetID = a.AssetID
		join #DepreciationBySetting dd on dd.DestructionID = si.DestructionID and dd.AssetID = si.AssetID
		join [AST].[FnFindCategoryAccount]() cat on cat.AssetCategoryID = a.AssetCategoryID

		update a
		set ErrorMessage =  isnull(ErrorMessage , '')+ 'معین هزینه استهلاک در برخی از گروهها انتخاب نشده است.' + char(10)+char(13)
		from #Destruction a
		join #PreVoucherItemTemp b on a.DestructionID = b.DestructionID
		join ast.Asset ass on ass.AssetID = b.AssetID
		join [AST].[FnFindCategoryAccount]() cat on cat.AssetCategoryID = ass.AssetCategoryID
		WHERE b.SlID IS NULL and cat.DepreciationCost is null

		update a
		set ErrorMessage =  isnull(ErrorMessage , '')+ 'معین استهلاک انباشته در برخی از گروهها انتخاب نشده است.' + char(10)+char(13)
		from #Destruction a
		join #PreVoucherItemTemp b on a.DestructionID = b.DestructionID
		WHERE b.SlID IS NULL 

		if exists (select * from #Destruction where ErrorMessage is not null )
		BEGIN	
			select DestructionID,ErrorMessage from #Destruction
			RETURN;
	    END

		insert into #PreVoucherItemTemp (PreVoucherID,DestructionItemID,SlID,Debit,Credit,AssetID,Description,Description2,DestructionID)
		select  h.PrevoucherID,
				si.DestructionItemID,
				h.LossFromDisaster,
		 		v.value - (case when a.Nature = 3 then isnull(aa.Depreciation , 0) else a.AccumulatedDepreciation + a.DuringDepreciation + isnull(aa.Depreciation , 0) end),
				0,
				si.AssetID,
				REPLACE(
				REPLACE(@CostDescription,
					'@@Plaque@@',isnull(a.Plaque,'')),
					'@@AssetTitle@@',a.Title),
				REPLACE(
				REPLACE(@CostDescription2,
					'@@Plaque@@',isnull(a.Plaque,'')),
					'@@AssetTitle@@',a.Title2),
				si.DestructionID
				
		from ast.DestructionItem si
		join #Destruction h on h.DestructionID = si.DestructionID
		join ast.Asset a on si.AssetID = a.AssetID
		join [AST].[FnFindCategoryAccount]() cat on cat.AssetCategoryID = a.AssetCategoryID
		left join #Depreciation aa on a.AssetID = aa.AssetID
		join #AssetValue v on v.AssetID = si.AssetID
		where v.value - (case when a.Nature = 3 then isnull(aa.Depreciation , 0) else a.AccumulatedDepreciation + a.DuringDepreciation + isnull(aa.Depreciation , 0) end) > 0
	

		insert into #PreVoucherItemTemp (PreVoucherID,DestructionItemID,SlID,Debit,Credit,AssetID,Description,Description2,DestructionID)
		select   h.PrevoucherID,
				 si.DestructionItemID,
				 cat.FixAsset,
				 0,
		 		 v.value,
				 si.AssetID,
				 REPLACE(
				 REPLACE(@AssetDescription,
					'@@Plaque@@',isnull(a.Plaque,'')),
					'@@AssetTitle@@',a.Title),
				 REPLACE(
				 REPLACE(@AssetDescription2,
					'@@Plaque@@',isnull(a.Plaque,'')),
					'@@AssetTitle@@',a.Title2),
				si.DestructionID
		from ast.DestructionItem si
		join #Destruction h on h.DestructionID = si.DestructionID
		join ast.Asset a on si.AssetID = a.AssetID
		join [AST].[FnFindCategoryAccount]() cat on cat.AssetCategoryID = a.AssetCategoryID
		join #AssetValue v on v.AssetID = si.AssetID


		update a
		set ErrorMessage =  isnull(ErrorMessage , '')+ 'معین دارایی ثابت در برخی از گروهها انتخاب نشده است.' + char(10)+char(13)
		from #Destruction a
		join #PreVoucherItemTemp b on a.DestructionID = b.DestructionID
		WHERE b.SlID IS NULL

		if exists (select * from #Destruction where ErrorMessage is not null )
		BEGIN	
			select DestructionID,ErrorMessage from #Destruction
			RETURN;
	    END

	    -- Insert Into PreVoucher Tabel
		set identity_insert [ACC].[PreVoucher] on	
	    INSERT INTO [ACC].[PreVoucher]([PreVoucherID],[BranchID],[DocumentNumtypeID],[Date],[FinancialPeriodID],[Description],[Description2],[Creator],[CreationDate],[LastEditor],[LastEditionDate],[Version])
		SELECT [PreVoucherID],BranchID,@DocumentNumTypeId,date,FinancialPeriodID,Description,Description,@CreatorId,GETDATE(),@CreatorId,GETDATE(),0
		from #Destruction
		set identity_insert [ACC].[PreVoucher] off
	    
	    UPDATE a
	    SET    PreVoucherID = b.PreVoucherId
		from ast.Destruction a
		join #Destruction b on a.DestructionID = b.DestructionID
	    
	    	    
		CREATE TABLE #ItemMap (RowID INT NOT NULL, PreVoucherItemID INT NOT NULL)

		MERGE ACC.PreVoucherItem AS tgt
		USING (select * from #PreVoucherItemTemp where Debit > 0) AS src
		ON 1 = 0
		WHEN NOT MATCHED THEN
			INSERT (PreVoucherID ,RowIndex,SlID,DESCRIPTION , Description2,Debit,Credit,CurrencyID ,CurrencyRate, CurrencyDebit, CurrencyCredit,Creator,  CreationDate,LastEditor,LastEditionDate,Version,BaseDocumentName,BaseDocumentID)
			VALUES (src.PreVoucherID,1,src.SlID,src.Description,src.Description2,src.Debit,0,-1,1,src.Debit,0,@CreatorId,GETDATE(),@CreatorId,GETDATE(),0,'DestructionItem',src.DestructionItemID)
		OUTPUT inserted.PreVoucherItemID, src.RowID INTO #ItemMap(PreVoucherItemID, RowID);

		MERGE ACC.PreVoucherItem AS tgt
		USING (select * from #PreVoucherItemTemp where Credit > 0) AS src
		ON 1 = 0
		WHEN NOT MATCHED THEN
			INSERT (PreVoucherID ,RowIndex,SlID,DESCRIPTION , Description2,Debit,Credit,CurrencyID ,CurrencyRate, CurrencyDebit, CurrencyCredit,Creator,  CreationDate,LastEditor,LastEditionDate,Version,BaseDocumentName,BaseDocumentID)
			VALUES (src.PreVoucherID,1,src.SlID,src.Description,src.Description2,0,src.Credit,-1,1,0,src.Credit,@CreatorId,GETDATE(),@CreatorId,GETDATE(),0,'DestructionItem',src.DestructionItemID)
		OUTPUT inserted.PreVoucherItemID, src.RowID INTO #ItemMap(PreVoucherItemID, RowID);

		-- تفصیلی: برای ردیف‌های استهلاک AssetSettingID دقیق همان محاسبه استفاده می‌شود (ممکن است چند تفصیلی متفاوت باشد)
		-- برای بقیه ردیف‌ها (دارایی ثابت، زیان/سود فروش، استهلاک انباشته قبلی) مثل قبل آخرین تنظیمات دارایی استفاده می‌شود
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
	        FROM  #PreVoucherItemTemp t
			join #ItemMap im on im.RowID = t.RowID
			join Acc.AccountLevelSL a  on a.SlID = t.SlID
	        left join
			(
				select ROW_NUMBER() over(partition by assetid order by date desc) Rno,*
				from ast.AssetSetting
			) c on c.AssetID = t.AssetID and c.Rno = 1
			join ast.AssetSettingDl d on d.AssetSettingID = isnull(t.AssetSettingID, c.AssetSettingID) and d.DlTypeID = a.DlTypeID
			group by im.PreVoucherItemID,a.AccountLevelID,d.DlID
	  	  

		;with temp as 
		(
			select  [pi].PreVoucherItemID,
					ROW_NUMBER() over(partition by pi.PreVoucherID order by pi.PreVoucherItemID) RowIndex,
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
						[pi].Description,
						'@@DestructionReason@@',i.DestructionReasonTitle),
						'@@Number@@',i.Number),
						'@@Date_Gregorian@@',i.FullDateAlternateKey),
						'@@Date_Solar@@',i.PersianFullDateAlternateKey) [Description],
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
						[pi].Description2,
						'@@DestructionReason@@',i.DestructionReasonTitle2),
						'@@Number@@',i.Number),
						'@@Date_Gregorian@@',i.FullDateAlternateKey),
						'@@Date_Solar@@',i.PersianFullDateAlternateKey)[Description2]
			from #Destruction i
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
					REPLACE(
						a.Description,
						'@@DestructionReason@@',b.DestructionReasonTitle),
						'@@Number@@',b.Number),
						'@@Date_Gregorian@@',b.FullDateAlternateKey),
						'@@Date_Solar@@',b.PersianFullDateAlternateKey)		,
			[Description2] =
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
						a.Description2,
						'@@DestructionReason@@',b.DestructionReasonTitle2),
						'@@Number@@',b.Number),
						'@@Date_Gregorian@@',b.FullDateAlternateKey),
						'@@Date_Solar@@',b.PersianFullDateAlternateKey)
		from acc.PreVoucher a
		join #Destruction b on a.PrevoucherID = b.PrevoucherID
