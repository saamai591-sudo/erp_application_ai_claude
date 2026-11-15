
CREATE  PROC [STF].[spStuffUpdate]
    @StuffID INT,
    @Type TINYINT,
    @Code NVARCHAR(256),
    @StuffGroupID INT,
    @Title NVARCHAR(MAX),
    @Title2 NVARCHAR(MAX),
    @ExemptOfPurchaseVat BIT,
    @ExemptOfSellVat BIT,
    @MainMeasureUnitID INT,
    @IsActive BIT,
    @Version INT,
    @LastEditor INT,
    @LastEditionDate DATETIME,
    @StockReceiptCostAgent BIT,
    @IsSpecialStuff BIT,
    @DutyRate DECIMAL(18, 4),
    @TaxRate DECIMAL(18, 4),
    @FixedAssetConversion BIT,
    @TopicTitle NVARCHAR(255),
    @TopicTitle2 NVARCHAR(255),
    @StandardTitle NVARCHAR(max),
    @StandardTitle2 NVARCHAR(max),
	@StuffNature tinyint,
	@ParentID int,
    @UniqueTaxID NVARCHAR(MAX),
    @WeightUnitID   INT,
    @WeighRatio   DECIMAL (36, 10)

--WITH ENCRYPTION 
AS
SET NOCOUNT ON;

    IF @Version <>
    (
        SELECT [Version] FROM [STF].[Stuff] WHERE [StuffID] = @StuffID
    )
        RAISERROR('Version mismatch...', 16, 10);


IF (@StuffNature = 2 OR @StuffNature = 3) AND @ParentID IS NULL
BEGIN

            RAISERROR('Parent Value Is Required.', 16, 12);
END

    DECLARE @Message NVARCHAR(MAX),
            @ResetStuffCodeBasedOnStuffGroup NVARCHAR(MAX),
			@headingLength int,
			@ItemLength int,
			@ParentCode varchar(250)

	select @ParentCode = Code
	from STF.Stuff
	where StuffID = @ParentID

	select @headingLength = ConfigValue
	 from CFG.Configuration
	where ConfigKey = 'HeadingSubheadingLength'

	select @ItemLength = ConfigValue
	 from CFG.Configuration
	where ConfigKey = 'ItemLength'


    SELECT @ResetStuffCodeBasedOnStuffGroup = ConfigValue
    FROM CFG.Configuration sc
    WHERE sc.ConfigKey = 'ResetStuffCodeBasedOnStuffGroup';

    DECLARE @len INT,
            @MaxCode decimal(38,0);

	if @StuffNature in (1,2) set @len = @headingLength
	if @StuffNature = 3 set @len = @ItemLength

    IF @Code IS NULL
       OR @Code = ''
    BEGIN

        IF NOT EXISTS
        (
            SELECT 1
            FROM STF.Stuff
            WHERE (
                      LOWER(@ResetStuffCodeBasedOnStuffGroup) = 'false'
                      OR StuffGroupID = ISNULL(@StuffGroupID, 0)
                  )
                  AND ISNUMERIC(Code) = 0
                   and type = @Type
        )
        BEGIN

            SELECT  @MaxCode = ISNULL(MAX(CAST(Code AS decimal(38,0))), 0) ,
					@len = case when @len is null or @len = 0 then ISNULL(LEN(MAX(Code)), 0) else @len end
            FROM STF.Stuff
            WHERE (
                      LOWER(@ResetStuffCodeBasedOnStuffGroup) = 'false'
					  OR @StuffGroupID IS NULL
                      OR StuffGroupID = @StuffGroupID
                  )
				  and Type = @Type
				  and StuffID <> @StuffID;

            IF @len >= LEN(@MaxCode + 1)
                SET @Code = REPLACE(STR(@MaxCode + 1, @len), ' ', '0');
            ELSE
                SET @Code = @MaxCode + 1;
        END;
    END;

    IF @Code IS NULL
       OR @Code = ''
        RAISERROR('Code_IsReq', 16, 12);

	if  @Type = 0
	AND @len is not null 
    AND @len > 0
    AND len(@Code)>@len
		begin
		 RAISERROR('StuffManager.Messages.StuffCodeDifferentSetting', 16, 12);
		end

	if  @Type = 0
	and @headingLength is not null 
	and @headingLength <> '' 
	and @headingLength <> '0' 
	and @StuffNature in (1,2)
	and LEN(@Code) <> @headingLength
		begin
		 RAISERROR('StuffManager.Messages.StuffCodeDifferentSetting', 16, 12);
		 end

	if  @Type = 0
	and  @ItemLength is not null 
	and @ItemLength <> '' 
	and @ItemLength <> '0' 
	and @StuffNature = 3
	and LEN(@Code) <> @ItemLength
		begin
		 RAISERROR('StuffManager.Messages.StuffCodeDifferentSetting', 16, 12);
		 end

	if @Code <= @ParentCode
	begin
		 RAISERROR('StuffManager.Messages.StuffCodeCannotBeSmallerThanParent', 16, 12);

	end

	if @Type = 0 
	AND exists (select code 
				from STF.Stuff 
				where StuffGroupID = @StuffGroupID 
				and
				( (@StuffNature = 2 and StuffNature = 1 )
				or
					(@StuffNature = 3 and StuffNature in (1,2))
				)
				and Code > @ParentCode and Code < @Code
				
				)
	begin
		 RAISERROR('StuffManager.Messages.StuffCodeIsNotTheBest', 16, 12);

	end

    IF LOWER(@ResetStuffCodeBasedOnStuffGroup) = 'false'
    BEGIN

        IF EXISTS
        (
            SELECT s.StuffID
            FROM STF.[Stuff] s
            WHERE s.StuffID <> @StuffID
                  AND s.Code = @Code
				  and s.type = @Type
        )
        BEGIN

            SELECT @Message = N'STF_spStuffInsert_1';

            RAISERROR(@Message, 16, 12);

        END;

    END;
    ELSE IF EXISTS
    (
        SELECT s.StuffID
        FROM STF.[Stuff] s
        WHERE s.StuffID <> @StuffID
              AND s.Code = @Code
              AND ISNULL(s.StuffGroupID, 0) = ISNULL(@StuffGroupID, 0)
			  and s.type = @Type
    )
    BEGIN
        SELECT @Message = N'STF_spStuffInsert_2';

        RAISERROR(@Message, 16, 12);
    END;


    UPDATE [STF].[Stuff]
    SET [Type] = @Type,
        [Code] = @Code,
        [StuffGroupID] = @StuffGroupID,
        [Title] = @Title,
        [Title2] = @Title2,
        [ExemptOfPurchaseVat] = @ExemptOfPurchaseVat,
        [ExemptOfSellVat] = @ExemptOfSellVat,
        [MainMeasureUnitID] = @MainMeasureUnitID,
        [IsActive] = @IsActive,
        [Version] = @Version + 1,
        [LastEditor] = @LastEditor,
        [LastEditionDate] = @LastEditionDate,
        [StockReceiptCostAgent] = @StockReceiptCostAgent,
        [IsSpecialStuff] = @IsSpecialStuff,
        [DutyRate] = @DutyRate,
        [TaxRate] = @TaxRate,
        [FixedAssetConversion] = @FixedAssetConversion,
		[TopicTitle] = @TopicTitle,
		[TopicTitle2] = @TopicTitle2,
		[StandardTitle] = @StandardTitle,
		[StandardTitle2] = @StandardTitle2,
		[StuffNature] = @StuffNature,
		[ParentID] = @ParentID,
        UniqueTaxID = @UniqueTaxID,
        WeightUnitID =@WeightUnitID,
        WeighRatio = @WeighRatio
    WHERE [StuffID] = @StuffID;

    -- Begin Return Select <- do not remove
    SELECT  [Version] 
        FROM [STF].[Stuff]
    WHERE [StuffID] = @StuffID;
-- End Return Select <- do not remove
