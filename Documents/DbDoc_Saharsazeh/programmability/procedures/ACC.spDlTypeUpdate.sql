CREATE   PROC [ACC].[spDlTypeUpdate] 
    @DlTypeID INT,
    @ParentID INT,
    @Code INT,
    @Title NVARCHAR(256),
    @Title2 NVARCHAR(256),
    @FirstNumber BIGINT,
    @LastNumber BIGINT,
    @IsManual BIT,
    @CodeLength INT,
    @Version INT,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME

		--WITH ENCRYPTION 
AS 
SET NOCOUNT ON 
 
	
IF @Version <> (
       SELECT [Version]
       FROM   [ACC].[DlType]
       WHERE  [DlTypeID] = @DlTypeID
   )
    RAISERROR('Version mismatch...', 16, 10)
	
DECLARE @Message NVARCHAR(MAX)
		
IF (
       @LastNumber < (
           SELECT MAX(Code)
           FROM   [ACC].[DL]
           WHERE  DlTypeID = @DlTypeID
       )
   )
BEGIN
   
    
    RAISERROR( 'ACC_spDlTypeUpdate_1', 16, 12)
    return
END
		
IF (
       @FirstNumber > (
           SELECT MIN(Code)
           FROM   [ACC].[DL]
           WHERE  DlTypeID = @DlTypeID
       )
   )
BEGIN
    
    
    RAISERROR( 'ACC_spDlTypeUpdate_2', 16, 12)
    return
END	
	
IF EXISTS (SELECT 1 FROM acc.DL AS d
           WHERE d.DlTypeID=@DlTypeID
		AND LEN(CODE)>@CodeLength
)
BEGIN
    RAISERROR('کد تفصیل با طول بزرگتر از طول مشخص شده وجود دارد', 16, 12)
    return
END		
	

UPDATE [ACC].[DlType]
SET    [ParentID] = @ParentID,
       [Code] = @Code,
       [Title] = @Title,
       [Title2] = @Title2,
       [FirstNumber] = @FirstNumber,
       [LastNumber] = @LastNumber,
       [IsManual] = @IsManual,
       CodeLength = @CodeLength,
       [Version] = @Version + 1,
       [LastEditor] = @LastEditor,
       [LastEditionDate] = @LastEditionDate
WHERE  [DlTypeID] = @DlTypeID
		
		-- Begin Return Select <- do not remove
SELECT [Version]
FROM   [ACC].[DlType]
WHERE  [DlTypeID] = @DlTypeID 
       -- End Return Select <- do not remove
