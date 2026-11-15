/*
  دریافت از شعبه (ReceivedFromBranch) — شرح‌های قابل‌تعریف توسط کاربر در صدور سند
  ------------------------------------------------------------------------------
  این اسکریپت دو کار می‌کند و روی هر دیتابیس را می‌شود چند بار اجرا کرد (idempotent):
    ۱) داده‌ی پیش‌فرض سه جدول CFG.VoucherDescription / CFG.VoucherDescriptionMetaData /
       CFG.VoucherDescriptionMetaDataParameter را برای Entity با نام AmountReceivedFromBranch
       فقط در صورتی درج می‌کند که ردیف مشابه (همان Key / ParamKey) وجود نداشته باشد؛
       ردیف‌هایی که کاربر قبلاً ساخته یا ویرایش کرده دست‌نخورده می‌مانند.
    ۲) پروسیجر AST.spReceivedFromBranchPreVoucherInsert (صدور پیش‌سند) را طوری تغییر می‌دهد که
       شرح سربرگ و ردیف‌ها را از جدول بالا بخواند و پارامترها (@@Number@@ و ...) را جایگزین کند.
       ACC.spIssuePreVoucher از قبل این پروسیجر را صدا می‌زند و نیازی به تغییر ندارد.

  کلیدها مثل فرم انتقال دارایی (Transfer):
    Header        سربرگ سند            پارامترها: Date_Gregorian, Date_Solar, Number, SourceBranch, DestinationBranch
    Asset         ردیف «دارایی ثابت»     پارامترها: AssetTitle, Plaque (+ پارامترهای سربرگ)
    Depreciation  ردیف «استهلاک انباشته»  پارامترها: AssetTitle, Plaque (+ پارامترهای سربرگ)
    Transfer      ردیف «نقل و انتقالات بین شعب»  پارامترها: AssetTitle, Plaque (+ پارامترهای سربرگ)
*/

-- ═════════════════ ۱) داده‌ی پیش‌فرض سه جدول ═════════════════
SET NOCOUNT ON;

DECLARE @MDEntity INT = (SELECT TOP (1) de.ID FROM mdt.DmdEntity AS de WHERE de.[Name] = 'AmountReceivedFromBranch' ORDER BY de.ID);

IF @MDEntity IS NULL
BEGIN
    RAISERROR(N'Entity با نام AmountReceivedFromBranch در MDT.DmdEntity پیدا نشد.', 16, 1);
    RETURN;
END

-- شرح‌ها (فارسی / انگلیسی)
DECLARE @Desc TABLE ([Key] VARCHAR(100), Description NVARCHAR(1024), Description2 NVARCHAR(1024));
INSERT INTO @Desc ([Key], Description, Description2) VALUES
 ('Header',       N'بابت سند دریافت از شعبه @@SourceBranch@@ شماره @@Number@@ تاریخ @@Date_Solar@@',
                  N'For Receipt From Branch @@SourceBranch@@ Number @@Number@@ Date @@Date_Gregorian@@'),
 ('Asset',        N'بابت دریافت دارایی @@AssetTitle@@ به پلاک @@Plaque@@',
                  N'For receiving asset @@AssetTitle@@ Plaque @@Plaque@@'),
 ('Depreciation', N'بابت استهلاک انباشته دارایی @@AssetTitle@@ به پلاک @@Plaque@@',
                  N'For accumulated depreciation of asset @@AssetTitle@@ Plaque @@Plaque@@'),
 ('Transfer',     N'بابت نقل و انتقالات بین شعب دارایی @@AssetTitle@@ به پلاک @@Plaque@@',
                  N'For transfers between branches of asset @@AssetTitle@@ Plaque @@Plaque@@');

INSERT INTO cfg.VoucherDescription (MDEntityID, [Key], Description, Description2, [Version], Creator, CreationDate, LastEditor, LastEditionDate)
SELECT @MDEntity, d.[Key], d.Description, d.Description2, 0, -1, GETDATE(), -1, GETDATE()
FROM @Desc d
WHERE NOT EXISTS (SELECT 1 FROM cfg.VoucherDescription t WHERE t.MDEntityID = @MDEntity AND t.[Key] = d.[Key]);

-- عنوان بخش‌ها در فرم تعریف شرح
INSERT INTO cfg.VoucherDescriptionMetaData (MDEntityID, [Key], FaTitle, EnTitle, [Version], Creator, CreationDate, LastEditor, LastEditionDate)
SELECT @MDEntity, m.[Key], m.FaTitle, m.EnTitle, 0, -1, GETDATE(), -1, GETDATE()
FROM (VALUES
    ('Header',       N'هدر',                     N'Header'),
    ('Asset',        N'دارایی ثابت',              N'Asset'),
    ('Depreciation', N'استهلاک انباشته',          N'Depreciation'),
    ('Transfer',     N'نقل و انتقالات بین شعب',   N'Transfer')
) AS m ([Key], FaTitle, EnTitle)
WHERE NOT EXISTS (SELECT 1 FROM cfg.VoucherDescriptionMetaData t WHERE t.MDEntityID = @MDEntity AND t.[Key] = m.[Key]);

-- پارامترهای قابل‌استفاده در هر شرح
INSERT INTO cfg.VoucherDescriptionMetaDataParameter (MDEntityID, [Key], ParamKey, FaTitle, EnTitle, [Version], Creator, CreationDate, LastEditor, LastEditionDate)
SELECT @MDEntity, p.[Key], p.ParamKey, p.FaTitle, p.EnTitle, 0, -1, GETDATE(), -1, GETDATE()
FROM (VALUES
    ('Header',       'Date_Gregorian',    N'تاریخ_میلادی',   N'AD date'),
    ('Header',       'Date_Solar',        N'تاریخ_خورشیدی',  N'Solar date'),
    ('Header',       'Number',            N'شماره',          N'Number'),
    ('Header',       'SourceBranch',      N'شعبه مبدا',      N'Source Branch'),
    ('Header',       'DestinationBranch', N'شعبه مقصد',      N'Destination Branch'),
    ('Asset',        'AssetTitle',        N'عنوان دارایی',   N'Asset Title'),
    ('Asset',        'Plaque',            N'پلاک دارایی',    N'Plaque'),
    ('Depreciation', 'AssetTitle',        N'عنوان دارایی',   N'Asset Title'),
    ('Depreciation', 'Plaque',            N'پلاک دارایی',    N'Plaque'),
    ('Transfer',     'AssetTitle',        N'عنوان دارایی',   N'Asset Title'),
    ('Transfer',     'Plaque',            N'پلاک دارایی',    N'Plaque')
) AS p ([Key], ParamKey, FaTitle, EnTitle)
WHERE NOT EXISTS (SELECT 1 FROM cfg.VoucherDescriptionMetaDataParameter t
                  WHERE t.MDEntityID = @MDEntity AND t.[Key] = p.[Key] AND t.ParamKey = p.ParamKey);

-- نتیجه (برای بررسی چشمی)
SELECT 'VoucherDescription' AS [Table], [Key], Description, Description2 FROM cfg.VoucherDescription WHERE MDEntityID = @MDEntity ORDER BY [Key];
SELECT 'MetaData' AS [Table], [Key], FaTitle, EnTitle FROM cfg.VoucherDescriptionMetaData WHERE MDEntityID = @MDEntity ORDER BY [Key];
SELECT 'Parameter' AS [Table], [Key], ParamKey, FaTitle, EnTitle FROM cfg.VoucherDescriptionMetaDataParameter WHERE MDEntityID = @MDEntity ORDER BY [Key], ParamKey;

-- فرم تعریف شرح (CFG.GetVoucherDescriptionForms) عنوان فرم را از MDT.DmdRelatedEntityTranslate می‌خواند؛ اگر ردیفی برنگشت، ترجمه‌ی Entity ثبت نشده است
SELECT CASE WHEN EXISTS (SELECT 1 FROM mdt.DmdRelatedEntityTranslate r WHERE r.DmdEntityID = @MDEntity)
            THEN N'ترجمه‌ی Entity موجود است' ELSE N'هشدار: برای این Entity در MDT.DmdRelatedEntityTranslate ترجمه ثبت نشده و در فرم تعریف شرح دیده نمی‌شود' END AS EntityTranslateCheck;
GO

-- ═════════════════ ۲) پروسیجر صدور پیش‌سند ═════════════════
CREATE OR ALTER PROCEDURE [AST].spReceivedFromBranchPreVoucherInsert
	@ReceivedFromBranchId NVARCHAR(MAX)
--WITH ENCRYPTION
AS
Begin

	    DECLARE @DocumentNumTypeId  INT = (SELECT DocumentNumTypeID  FROM   CFG.DocumentNumType  WHERE EngName = 'ReceivedFromBranch' ),
	            @MDEntity INT = (select Top (1) de.ID from mdt.DmdEntity AS de  where de.[Name] = 'AmountReceivedFromBranch' ORDER BY de.ID),
				@MaxPrevoucherID int,
		        @HeaderDescription NVARCHAR(MAX),
				@HeaderDescription2 NVARCHAR(MAX),
				@AssetDescription NVARCHAR(MAX),
				@AssetDescription2 NVARCHAR(MAX),
				@DepreciationDescription NVARCHAR(MAX),
				@DepreciationDescription2 NVARCHAR(MAX),
				@TransferDescription NVARCHAR(MAX),
				@TransferDescription2 NVARCHAR(MAX),
				@CreatorId int,
				@Culture VARCHAR(10),
				@CultureNo TinyInt

		SET @CreatorId = cfg.GetuserID();
		SET @Culture = CFG.GetuserCulture();

		select @CultureNo = CultureNo
		from cfg.CultureInfo
		where Culture = @Culture;

		SELECT [value] ID
		INTO #DocumentIds
		FROM   cfg.R_FnCommaStr2Table(@ReceivedFromBranchId)

		-- شرح‌های تعریف‌شده توسط کاربر (CFG.VoucherDescription)
		select  @HeaderDescription = Description,
				@HeaderDescription2 = Description2
		from CFG.[VoucherDescription]
		where MDEntityID = @MDEntity and [Key] = 'Header'

		select  @AssetDescription = Description,
				@AssetDescription2 = Description2
		from CFG.[VoucherDescription]
		where MDEntityID = @MDEntity and [Key] = 'Asset'

		select  @DepreciationDescription = Description,
				@DepreciationDescription2 = Description2
		from CFG.[VoucherDescription]
		where MDEntityID = @MDEntity and [Key] = 'Depreciation'

		select  @TransferDescription = Description,
				@TransferDescription2 = Description2
		from CFG.[VoucherDescription]
		where MDEntityID = @MDEntity and [Key] = 'Transfer'

		select @MaxPrevoucherID = MAX(PreVoucherID)
		from acc.PreVoucher
	    --- FetchValues ---
	    SELECT  isnull(@MaxPrevoucherID,0) + ROW_NUMBER() over(order by ReceivedFromBranchID) PrevoucherID,
				ReceivedFromBranchID,
				c.DestinationBranchID  BranchID,
				c.FinancialPeriodID,
				c.date,
				-- اگر شرح سربرگ تعریف نشده باشد همان متن قبلی استفاده می‌شود
				ISNULL(@HeaderDescription, N'بابت سند دریافت از شعبه') Description,
				ISNULL(@HeaderDescription2, N'For Receipt From Branch') Description2,
				cast(null as varchar(max)) ErrorMessage,
				f.StartDate,
				c.Number,
				c.SourceBranchID,
				c.DestinationBranchID,
				dd.FullDateAlternateKey,
				dd.PersianFullDateAlternateKey,
				sb.Title SourceBranchTitle,
				sb.Title2 SourceBranchTitle2,
				db.Title DestinationBranchTitle,
				db.Title2 DestinationBranchTitle2
			into #ReceivedFromBranch
	    FROM   AST.ReceivedFromBranch c
		JOIN #DocumentIds b on c.ReceivedFromBranchID = b.ID
		JOIN cfg.DimDate DD on DD.Date = c.Date
		join cfg.FinancialPeriod f on f.FinancialPeriodID = c.FinancialPeriodID
		join cfg.Branch sb on sb.BranchID = c.SourceBranchID
		join cfg.Branch db on db.BranchID = c.DestinationBranchID
		where c.PreVoucherID is null

		-- جایگزینی پارامترهای سربرگ در شرح سربرگ، پیش از درج PreVoucher
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
		FROM #ReceivedFromBranch t


		select d.AssetID, sum(Value) Value, ast2.AssetCategoryID
		into #Depreciation
		from ast.ReceivedFromBranchItem rfbi
		join ast.Asset ast2 on ast2.ReceivedFromBranchItemID = rfbi.ReceivedFromBranchItemID
		join ast.Depreciation d on d.AssetID = ast2.AssetID
		join #ReceivedFromBranch h on h.ReceivedFromBranchID = rfbi.ReceivedFromBranchID
		where d.Date <= h.StartDate
		group by d.AssetID, ast2.AssetCategoryID

		select d.AssetID,ast2.AssetCategoryID, sum(Value) BaseValue
		into #AssetValue
		from ast.ReceivedFromBranchItem rfbi
		join ast.Asset ast2 on ast2.ReceivedFromBranchItemID = rfbi.ReceivedFromBranchItemID
		join ast.[VWAssetValue] d on d.AssetID = ast2.AssetID
		join #ReceivedFromBranch h on h.ReceivedFromBranchID = rfbi.ReceivedFromBranchID
		where d.Date <= ast2.AssetCreationDate
		group by d.AssetID, ast2.AssetCategoryID


		select rfb.ReceivedFromBranchID, a.AssetCategoryID,case when @CultureNo = 1 then ac.Title else ac.Title2 End AssetCategoryTitle
		,sls.FixAsset,sls.AccumulatedDepreciation,sls.TransfersBetweenBranches
		into #Items
		from #ReceivedFromBranch rfb
		join ast.ReceivedFromBranchItem rfbi on rfb.ReceivedFromBranchID = rfbi.ReceivedFromBranchID
		join ast.Asset a on rfbi.ReceivedFromBranchItemID = a.ReceivedFromBranchItemID
		join [AST].[FnFindCategoryAccount]() sls on a.AssetCategoryID = sls.AssetCategoryID
		join ast.AssetCategory ac on a.AssetCategoryID = ac.AssetCategoryID


		update rfb
		set rfb.ErrorMessage = isnull(ErrorMessage,'') + 'AssetManager.Messages.FixAssetSlInAssetCategory^'+AssetCategoryTitle+char(10)+char(13)
		from #ReceivedFromBranch rfb
		join #Items av on rfb.ReceivedFromBranchID = av.ReceivedFromBranchID
		where FixAsset is null
		----معین استهلاک انباشته در گروه دارایی تعیین نشده است.
		update rfb
		set rfb.ErrorMessage = isnull(ErrorMessage,'') + 'AssetManager.Messages.AccumulatedDepreciationSlInAssetCategory^'+AssetCategoryTitle+char(10)+char(13)
		from #ReceivedFromBranch rfb
		join #Items av on rfb.ReceivedFromBranchID = av.ReceivedFromBranchID
		where AccumulatedDepreciation is null
		----------معین نقل و انتقالات بین شعب در گروه دارایی تعیین نشده است.
			update rfb
		set rfb.ErrorMessage = isnull(ErrorMessage,'') + 'AssetManager.Messages.TransfersBetweenBranchesSlInAssetCategory^'+AssetCategoryTitle+char(10)+char(13)
		from #ReceivedFromBranch rfb
		join #Items av on rfb.ReceivedFromBranchID = av.ReceivedFromBranchID
		where TransfersBetweenBranches is null


		if exists (select * from #ReceivedFromBranch where ErrorMessage is not null )
		BEGIN
			SELECT ReceivedFromBranchID,ErrorMessage from #ReceivedFromBranch
			where ErrorMessage is not null
			RETURN;
		END



	    -- Insert Into PreVoucher Tabel
		set identity_insert [ACC].[PreVoucher] on
	    INSERT INTO [ACC].[PreVoucher]([PreVoucherID],BranchID,[DocumentNumtypeID],[Date],[FinancialPeriodID],[Description],[Description2],[Creator],[CreationDate],[LastEditor],[LastEditionDate],[Version])
		SELECT [PreVoucherID],BranchId,@DocumentNumTypeId,date,FinancialPeriodID,Description,Description2,@CreatorId,GETDATE(),@CreatorId,GETDATE(),0
		from #ReceivedFromBranch
		set identity_insert [ACC].[PreVoucher] off

	    UPDATE a
	    SET    PreVoucherID = b.PreVoucherId
		from ast.ReceivedFromBranch a
		join #ReceivedFromBranch b on a.ReceivedFromBranchID = b.ReceivedFromBranchID



		-- Destination Branch Fix Asset (دارایی نزد شعبه‌ی مقصد)
		-- شرح: کلید Asset؛ اگر تعریف نشده باشد شرح خود ردیف و بعد شرح سربرگ
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
			isnull(REPLACE(REPLACE(@AssetDescription, N'@@Plaque@@', ISNULL(ast.Plaque, N'')), N'@@AssetTitle@@', ISNULL(ast.Title, N'')), isnull(a.Description,c.Description)),
			isnull(REPLACE(REPLACE(@AssetDescription2, N'@@Plaque@@', ISNULL(ast.Plaque, N'')), N'@@AssetTitle@@', ISNULL(ast.Title2, N'')), isnull(a.Description2,c.Description2)),
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
		from ast.ReceivedFromBranchItem a
		join ast.Asset ast on a.ReceivedFromBranchItemID = ast.ReceivedFromBranchItemID
		join #AssetValue s on s.AssetID = ast.AssetID
		join #ReceivedFromBranch c on c.ReceivedFromBranchID = a.ReceivedFromBranchID
		join [AST].[FnFindCategoryAccount]() b on b.AssetCategoryID = s.AssetCategoryID

		-- Destination Branch Accumulated Depreciation (استهلاک انباشته نزد شعبه‌ی مقصد)
		-- شرح: کلید Depreciation
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
			isnull(REPLACE(REPLACE(@DepreciationDescription, N'@@Plaque@@', ISNULL(s.Plaque, N'')), N'@@AssetTitle@@', ISNULL(s.Title, N'')), isnull(a.Description,c.Description)),
			isnull(REPLACE(REPLACE(@DepreciationDescription2, N'@@Plaque@@', ISNULL(s.Plaque, N'')), N'@@AssetTitle@@', ISNULL(s.Title2, N'')), isnull(a.Description2,c.Description2)),
			0,
			isnull(s.AccumulatedDepreciation , 0) + isnull(s.DuringDepreciation,0),
			-1,
			1,
			0,
			isnull(s.AccumulatedDepreciation , 0) + isnull(s.DuringDepreciation,0),
			@CreatorId,
			GETDATE(),
			@CreatorId,
			GETDATE(),
			0
		from ast.ReceivedFromBranchItem a
		join ast.asset s on s.ReceivedFromBranchItemID = a.ReceivedFromBranchItemID
		join #ReceivedFromBranch c on c.ReceivedFromBranchID = a.ReceivedFromBranchID
		join [AST].[FnFindCategoryAccount]() b on b.AssetCategoryID = s.AssetCategoryID
		where  (s.AccumulatedDepreciation >0 or s.DuringDepreciation >0)


		-------------Difference between accountlated depreciation and base value vouchered to transfersl
		-- شرح: کلید Transfer

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
			b.TransfersBetweenBranches ,
			isnull(REPLACE(REPLACE(@TransferDescription, N'@@Plaque@@', ISNULL(s.Plaque, N'')), N'@@AssetTitle@@', ISNULL(s.Title, N'')), isnull(a.Description,c.Description)),
			isnull(REPLACE(REPLACE(@TransferDescription2, N'@@Plaque@@', ISNULL(s.Plaque, N'')), N'@@AssetTitle@@', ISNULL(s.Title2, N'')), isnull(a.Description2,c.Description2)),
			0,
			s.basevalue - isnull(s.AccumulatedDepreciation, 0) - isnull(s.DuringDepreciation, 0),
			-1,
			1,
			0,
			s.basevalue - isnull(s.AccumulatedDepreciation, 0) - isnull(s.DuringDepreciation, 0),
			@CreatorId,
			GETDATE(),
			@CreatorId,
			GETDATE(),
			0


	from ast.ReceivedFromBranchItem a
		join ast.asset s on s.ReceivedFromBranchItemID = a.ReceivedFromBranchItemID
		join #ReceivedFromBranch c on c.ReceivedFromBranchID = a.ReceivedFromBranchID
		join [AST].[FnFindCategoryAccount]() b on b.AssetCategoryID = s.AssetCategoryID
	where (s.basevalue - isnull(s.AccumulatedDepreciation, 0) - isnull(s.DuringDepreciation, 0)) > 0


		-- جایگزینی پارامترهای سربرگ (شماره، تاریخ، شعبه مبدا/مقصد) در شرح ردیف‌ها
		-- (پارامترهای AssetTitle و Plaque بالاتر هنگام درج جایگزین شده‌اند)
		update pvi
		set [Description] =
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
						ISNULL(pvi.[Description], N''),
						N'@@DestinationBranch@@', ISNULL(i.DestinationBranchTitle, N'')),
						N'@@SourceBranch@@', ISNULL(i.SourceBranchTitle, N'')),
						N'@@Number@@', ISNULL(CAST(i.Number AS NVARCHAR(50)), N'')),
						N'@@Date_Gregorian@@', ISNULL(i.FullDateAlternateKey, N'')),
						N'@@Date_Solar@@', ISNULL(i.PersianFullDateAlternateKey, N'')),
			[Description2] =
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
						ISNULL(pvi.[Description2], N''),
						N'@@DestinationBranch@@', ISNULL(i.DestinationBranchTitle2, N'')),
						N'@@SourceBranch@@', ISNULL(i.SourceBranchTitle2, N'')),
						N'@@Number@@', ISNULL(CAST(i.Number AS NVARCHAR(50)), N'')),
						N'@@Date_Gregorian@@', ISNULL(i.FullDateAlternateKey, N'')),
						N'@@Date_Solar@@', ISNULL(i.PersianFullDateAlternateKey, N''))
		from acc.PreVoucherItem pvi
		join #ReceivedFromBranch i on pvi.PreVoucherID = i.PreVoucherID

END
GO
