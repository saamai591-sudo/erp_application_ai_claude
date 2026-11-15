-------------------------------------
CREATE   PROC [ACC].[spSLInsert] 
    @ParentID INT,
    @CurrencyExchangeSlID INT,
    @Code VARCHAR(50),
    @Title NVARCHAR(256),
    @Title2 NVARCHAR(256),
    @BalanceTypeID tinyint,
    @HasBalanceTypeCheck BIT,
    @HasCurrency BIT,
    @HasCurrencyConversion BIT,
    @IsActive BIT,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME,
    @SlTreeLevelID INT,
    @IsMoeen   BIT

		--WITH ENCRYPTION 
AS 
SET NOCOUNT ON 
SET XACT_ABORT ON  
	
	
IF EXISTS(
       SELECT 1
       FROM   acc.SL AS s
       WHERE  s.ParentID = @ParentID
              AND s.Code = @Code
   )
BEGIN
    RAISERROR('کد تکراري مي باشد.', 16, 12)
    RETURN 0;
END 

IF EXISTS (SELECT 1 FROM acc.sl
           WHERE IsMoeen=1 AND SlID=@ParentID
)
BEGIN
	RAISERROR('Accounting.SL_Is_Not_Valid_Parent', 16, 12)
    RETURN 0;
END

IF @IsMoeen=1 AND EXISTS(SELECT 1 FROM acc.SlTreeLevel AS stl
                   WHERE stl.SlTreeLevelID=@SlTreeLevelID AND stl.LevelType <> 4 ) 
BEGIN
	RAISERROR('Accounting.Only_Other_Can_Be_Sl', 16, 12)
    RETURN 0;
END

INSERT INTO [ACC].[SL]
  (
    [ParentID],
    [CurrencyExchangeSlID],
    [Code],
    [Title],
    [Title2],
    [BalanceTypeID],
    [HasBalanceTypeCheck],
    [HasCurrency],
    [HasCurrencyConversion],
    [IsActive],
    [Version],
    [Creator],
    [CreationDate],
    [LastEditor],
    [LastEditionDate],
    [SlTreeLevelID],IsMoeen
  )
SELECT @ParentID,
       @CurrencyExchangeSlID,
       @Code,
       @Title,
       @Title2,
       @BalanceTypeID,
       @HasBalanceTypeCheck,
       @HasCurrency,
       @HasCurrencyConversion,
       @IsActive,
       0,
       @Creator,
       @CreationDate,
       @LastEditor,
       @LastEditionDate,
       @SlTreeLevelID,
       @IsMoeen
	
	-- Begin Return Select <- do not remove
SELECT [SlID],
       [Version]
FROM   [ACC].[SL]
WHERE  [SlID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
