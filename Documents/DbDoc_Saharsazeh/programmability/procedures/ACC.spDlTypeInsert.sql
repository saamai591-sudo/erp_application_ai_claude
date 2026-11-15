CREATE   PROC [ACC].[spDlTypeInsert] 
    @ParentID INT,
    @Code INT,
    @Title NVARCHAR(256),
    @Title2 NVARCHAR(256),
    @FirstNumber BIGINT,
    @LastNumber BIGINT,
    @IsManual BIT,
    @CodeLength INT,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME
		--WITH ENCRYPTION 
AS 
SET NOCOUNT ON 
SET XACT_ABORT ON 

SET @Code = ISNULL(
        (
            SELECT MAX(Code) + 1
            FROM   [ACC].[DlType]
            WHERE  [Code] < 100
        ),
        1
    )

INSERT INTO [ACC].[DlType]
  (
    [ParentID],
    [Code],
    [Title],
    [Title2],
    [FirstNumber],
    [LastNumber],
    [IsManual],
    CodeLength,
    [Version],
    [Creator],
    [CreationDate],
    [LastEditor],
    [LastEditionDate]
  )
SELECT @ParentID,
       @Code,
       @Title,
       @Title2,
       @FirstNumber,
       @LastNumber,
       @IsManual,
       @CodeLength,
       0,
       @Creator,
       @CreationDate,
       @LastEditor,
       @LastEditionDate
	
	-- Begin Return Select <- do not remove
SELECT [DlTypeID],
       [Version],
       [Code]
FROM   [ACC].[DlType]
WHERE  [DlTypeID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
