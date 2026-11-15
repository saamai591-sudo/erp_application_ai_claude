
CREATE   PROCEDURE [AST].spChangeCategoryPreVoucherInsert
	@ChangeCategoryId NVARCHAR(MAX)
--WITH ENCRYPTION 
	 AS 

	
	    DECLARE @DocumentNumTypeId  INT = (SELECT DocumentNumTypeID  FROM   CFG.DocumentNumType  WHERE EngName = 'ChangeCategory' ),
	            @MDEntity INT = (select Top (1) de.ID from mdt.DmdEntity AS de  where de.[Name] = 'ChangeCategory' ORDER BY de.ID),
				@MaxPrevoucherID int,
		        @HeaderDescription NVARCHAR(MAX),
				@HeaderDescription2 NVARCHAR(MAX),
				@DepreciationDescription NVARCHAR(MAX),
				@DepreciationDescription2 NVARCHAR(MAX),
				@CreatorId int

		SET @CreatorId = cfg.GetuserID();

		SELECT [value] ID	            
		INTO #DocumentIds
		FROM   cfg.R_FnCommaStr2Table(@ChangeCategoryId) 		            
       
		select  @HeaderDescription = Description,
				@HeaderDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'Header'

		select  @DepreciationDescription = Description,
				@DepreciationDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'Depreciation'
	    
	  	    
		select @MaxPrevoucherID = MAX(PreVoucherID)
		from acc.PreVoucher
	    --- FetchValues ---
	    SELECT  isnull(@MaxPrevoucherID,0) + ROW_NUMBER() over(order by ChangeCategoryID) PrevoucherID,	
				ChangeCategoryID,
				c.BranchID,
				c.FinancialPeriodID,
				c.date,
				@HeaderDescription Description,
				@HeaderDescription2 Description2,
				cast(null as varchar(max)) ErrorMessage,
				f.StartDate,
				AssetCategoryID,
				Number,
				dd.FullDateAlternateKey,
				dd.PersianFullDateAlternateKey
			into #ChangeCategory
	    FROM   AST.ChangeCategory c
		JOIN #DocumentIds b on c.ChangeCategoryID = b.ID
		JOIN cfg.DimDate DD on DD.Date = c.Date
		join cfg.FinancialPeriod f on f.FinancialPeriodID = c.FinancialPeriodID
		where c.PreVoucherID is null


		select d.AssetID , sum(Value) Value
		into #Depreciation
		from ast.ChangeCategoryItem cci
		join ast.Depreciation d on d.AssetID = cci.AssetID
		join #ChangeCategory h on h.ChangeCategoryID = cci.ChangeCategoryID
		where (d.Date <= h.StartDate
			or (d.[Document] = 'ChangeCategory' and d.ChangeCategoryID = h.ChangeCategoryID))
		group by d.AssetID

		select d.AssetID , sum(Value) BaseValue
		into #AssetValue
		from ast.ChangeCategoryItem cci
		join ast.[VWAssetValue] d on d.AssetID = cci.AssetID
		join #ChangeCategory h on h.ChangeCategoryID = cci.ChangeCategoryID
		where d.Date <= h.Date
		group by d.AssetID
	    
		
		-- Depreciation calculated together with this operation (until the change date) belongs to the previous category.
		-- An asset can have several AssetSettingID in one calculation (different DLs), so one row per AssetSettingID.
		select d.ChangeCategoryID, d.AssetID, d.AssetSettingID, sum(d.Value) Value
		into #DepreciationBySetting
		from ast.Depreciation d
		join #ChangeCategory h on h.ChangeCategoryID = d.ChangeCategoryID
		where d.[Document] = 'ChangeCategory'
		group by d.ChangeCategoryID, d.AssetID, d.AssetSettingID
		having sum(d.Value) > 0

		CREATE TABLE #DepLines
		(
			PreVoucherID INT NULL,
			ChangeCategoryID INT NULL,
			AssetID INT NULL,
			AssetSettingID INT NULL,
			SlID INT NULL,
			Debit DECIMAL(30,4) NULL,
			Credit DECIMAL(30,4) NULL,
			Description NVARCHAR(MAX) NULL,
			Description2 NVARCHAR(MAX) NULL,
			RowID INT IDENTITY(1,1) NOT NULL
		)

		-- Debit: depreciation cost of the previous category
		insert into #DepLines (PreVoucherID, ChangeCategoryID, AssetID, AssetSettingID, SlID, Debit, Credit, Description, Description2)
		select  h.PreVoucherID,
				h.ChangeCategoryID,
				a.AssetID,
				dd.AssetSettingID,
				cat.DepreciationCost,
				dd.Value,
				0,
				ISNULL(REPLACE(REPLACE(@DepreciationDescription, '@@Plaque@@', isnull(s.Plaque,'')), '@@AssetTitle@@', s.Title), h.Description),
				ISNULL(REPLACE(REPLACE(@DepreciationDescription2, '@@Plaque@@', isnull(s.Plaque,'')), '@@AssetTitle@@', s.Title2), h.Description2)
		from ast.ChangeCategoryItem a
		join #ChangeCategory h on h.ChangeCategoryID = a.ChangeCategoryID
		join ast.Asset s on s.AssetID = a.AssetID
		join #DepreciationBySetting dd on dd.ChangeCategoryID = a.ChangeCategoryID and dd.AssetID = a.AssetID
		join [AST].[FnFindCategoryAccount]() cat on cat.AssetCategoryID = a.PreviousCategoryID

		-- Credit: accumulated depreciation of the previous category
		insert into #DepLines (PreVoucherID, ChangeCategoryID, AssetID, AssetSettingID, SlID, Debit, Credit, Description, Description2)
		select  h.PreVoucherID,
				h.ChangeCategoryID,
				a.AssetID,
				dd.AssetSettingID,
				cat.AccumulatedDepreciation,
				0,
				dd.Value,
				ISNULL(REPLACE(REPLACE(@DepreciationDescription, '@@Plaque@@', isnull(s.Plaque,'')), '@@AssetTitle@@', s.Title), h.Description),
				ISNULL(REPLACE(REPLACE(@DepreciationDescription2, '@@Plaque@@', isnull(s.Plaque,'')), '@@AssetTitle@@', s.Title2), h.Description2)
		from ast.ChangeCategoryItem a
		join #ChangeCategory h on h.ChangeCategoryID = a.ChangeCategoryID
		join ast.Asset s on s.AssetID = a.AssetID
		join #DepreciationBySetting dd on dd.ChangeCategoryID = a.ChangeCategoryID and dd.AssetID = a.AssetID
		join [AST].[FnFindCategoryAccount]() cat on cat.AssetCategoryID = a.PreviousCategoryID

		update h
		set ErrorMessage = isnull(h.ErrorMessage, '') + 'معین هزینه استهلاک یا استهلاک انباشته در برخی از گروهها انتخاب نشده است.' + char(10)+char(13)
		from #ChangeCategory h
		join #DepLines b on b.ChangeCategoryID = h.ChangeCategoryID
		where b.SlID is null

		if exists (select * from #ChangeCategory where ErrorMessage is not null)
		BEGIN
			select ChangeCategoryID, ErrorMessage from #ChangeCategory
			RETURN;
		END

	    -- Insert Into PreVoucher Tabel
		set identity_insert [ACC].[PreVoucher] on	
	    INSERT INTO [ACC].[PreVoucher]([PreVoucherID],BranchID,[DocumentNumtypeID],[Date],[FinancialPeriodID],[Description],[Description2],[Creator],[CreationDate],[LastEditor],[LastEditionDate],[Version])
		SELECT [PreVoucherID],BranchId,@DocumentNumTypeId,date,FinancialPeriodID,Description,Description2,@CreatorId,GETDATE(),@CreatorId,GETDATE(),0
		from #ChangeCategory
		set identity_insert [ACC].[PreVoucher] off
	    
	    UPDATE a
	    SET    PreVoucherID = b.PreVoucherId
		from ast.ChangeCategory a
		join #ChangeCategory b on a.ChangeCategoryID = b.ChangeCategoryID
 
		-- New Fix Asset Group
	    INSERT INTO ACC.PreVoucherItem 
			(PreVoucherID ,
			 RowIndex,
			 SlID,
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
			b.FixAsset,
			Description,
			Description2,
			s.BaseValue,
			0,
			-1,
			1,
			s.BaseValue,
			0,
			@CreatorId,
			GETDATE(),
			@CreatorId,
			GETDATE(),
			0
		from ast.ChangeCategoryItem a
		join #AssetValue s on s.AssetID = a.AssetID
		join #ChangeCategory c on c.ChangeCategoryID = a.ChangeCategoryID
		join [AST].[FnFindCategoryAccount]() b on b.AssetCategoryID = c.AssetCategoryID

		-- Old Dep Cost
	    INSERT INTO ACC.PreVoucherItem 
			(PreVoucherID ,
			 RowIndex,
			 SlID,
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
			h.PreVoucherId,
			1,
			b.AccumulatedDepreciation ,
			Description,
			Description2,
			case when s.Nature = 3 then isnull(d.Value , 0)
				 else s.AccumulatedDepreciation + s.DuringDepreciation + isnull(d.Value , 0) end,
			0,
			-1,
			1,
			case when s.Nature = 3 then isnull(d.Value , 0)
				 else s.AccumulatedDepreciation + s.DuringDepreciation + isnull(d.Value , 0) end,
			0,
			@CreatorId,
			GETDATE(),
			@CreatorId,
			GETDATE(),
			0
		from ast.ChangeCategoryItem a
		join ast.asset s on s.AssetID = a.AssetID
		join [AST].[FnFindCategoryAccount]() b on b.AssetCategoryID = a.PreviousCategoryID
		left join #Depreciation d on d.AssetID = s.AssetID
		join #ChangeCategory h on a.ChangeCategoryID = h.ChangeCategoryId
		where s.AccumulatedDepreciation + ISNULL(d.Value,0) > 0 

		-- Old Fix Asset Group
	    INSERT INTO ACC.PreVoucherItem 
			(PreVoucherID ,
			 RowIndex,
			 SlID,
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
			b.FixAsset,
			Description,
			Description2,
			0,
			s.BaseValue,
			-1,
			1,
			0,
			s.BaseValue,
			@CreatorId,
			GETDATE(),
			@CreatorId,
			GETDATE(),
			0
		from ast.ChangeCategoryItem a
		join #AssetValue s on s.AssetID = a.AssetID
		join [AST].[FnFindCategoryAccount]() b on b.AssetCategoryID = A.PreviousCategoryID
		join #ChangeCategory h on a.ChangeCategoryID = h.ChangeCategoryId

		-- New Dep Cost
	    INSERT INTO ACC.PreVoucherItem 
			(PreVoucherID ,
			 RowIndex,
			 SlID,
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
			c.PreVoucherId,
			1,
			b.AccumulatedDepreciation ,
			Description,
			Description2,
			0,
			case when s.Nature = 3 then isnull(d.Value , 0)
				 else s.AccumulatedDepreciation + s.DuringDepreciation + isnull(d.Value , 0) end,
			-1,
			1,
			0,
			case when s.Nature = 3 then isnull(d.Value , 0)
				 else s.AccumulatedDepreciation + s.DuringDepreciation + isnull(d.Value , 0) end,
			@CreatorId,
			GETDATE(),
			@CreatorId,
			GETDATE(),
			0
		from ast.ChangeCategoryItem a
		join #ChangeCategory c on c.ChangeCategoryID = a.ChangeCategoryID
		join ast.asset s on s.AssetID = a.AssetID
		join [AST].[FnFindCategoryAccount]() b on b.AssetCategoryID = c.AssetCategoryID
		left join #Depreciation d on d.AssetID = s.AssetID
		where  s.AccumulatedDepreciation +  ISNULL(d.Value,0) > 0


		CREATE TABLE #ItemMap (RowID INT NOT NULL, PreVoucherItemID INT NOT NULL)

		MERGE ACC.PreVoucherItem AS tgt
		USING (select * from #DepLines) AS src
		ON 1 = 0
		WHEN NOT MATCHED THEN
			INSERT (PreVoucherID, RowIndex, SlID, DESCRIPTION, Description2, Debit, Credit, CurrencyID, CurrencyRate, CurrencyDebit, CurrencyCredit, Creator, CreationDate, LastEditor, LastEditionDate, Version)
			VALUES (src.PreVoucherID, 1, src.SlID, src.Description, src.Description2, src.Debit, src.Credit, -1, 1, src.Debit, src.Credit, @CreatorId, GETDATE(), @CreatorId, GETDATE(), 0)
		OUTPUT inserted.PreVoucherItemID, src.RowID INTO #ItemMap(PreVoucherItemID, RowID);

		-- DL of the depreciation lines comes from the exact AssetSettingID of the calculation
		INSERT INTO Acc.PreVoucherItemAccountLevel
			(PreVoucherItemID, AccountLevelID, DLID, [Value], Creator, CreationDate, LastEditor, LastEditionDate, Version)
		SELECT  im.PreVoucherItemID,
				a.AccountLevelID,
				d.DlID,
				NULL,
				@CreatorId,
				GETDATE(),
				@CreatorId,
				GETDATE(),
				0
		FROM  #DepLines t
		join #ItemMap im on im.RowID = t.RowID
		join Acc.AccountLevelSL a on a.SlID = t.SlID
		join ast.AssetSettingDl d on d.AssetSettingID = t.AssetSettingID and d.DlTypeID = a.DlTypeID
		group by im.PreVoucherItemID, a.AccountLevelID, d.DlID
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
			from #ChangeCategory i
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
						'@@Date_Gregorian@@',FullDateAlternateKey),
						'@@Date_Solar@@',PersianFullDateAlternateKey)		
		,
			[Description2] =
					REPLACE(
					REPLACE(
					REPLACE(
						[pi].Description2,
						'@@Number@@',i.Number),
						'@@Date_Gregorian@@',FullDateAlternateKey),
						'@@Date_Solar@@',PersianFullDateAlternateKey)
		from acc.PreVoucher pi
		join #ChangeCategory i on pi.PrevoucherID = i.PrevoucherID

