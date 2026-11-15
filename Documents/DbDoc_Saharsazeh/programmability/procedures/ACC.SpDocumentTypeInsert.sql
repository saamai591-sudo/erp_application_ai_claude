CREATE     PROC [ACC].[SpDocumentTypeInsert]
    @Title NVARCHAR(256),
    @Title2 VARCHAR(256),
    @IsSystem BIT = 0,
    @DefaultSelectInReport BIT = 1,
    @isActive BIT = 1,
    @Creator INT,
    @CreationDate DATETIME,
    @engname VARCHAR(50)
--WITH ENCRYPTION
AS
SET NOCOUNT ON;

DECLARE @Message NVARCHAR(MAX);

IF EXISTS (SELECT 1 FROM ACC.DocumentType WHERE Title = @Title)
BEGIN
    RAISERROR('Title_Duplicated', 16, 12);
    RETURN;
END;

IF EXISTS (SELECT 1 FROM ACC.DocumentType WHERE Title2 = @Title2)
BEGIN

    RAISERROR('Title2_Duplicated', 16, 12);
    RETURN;
END;


INSERT INTO [ACC].[DocumentType]
(
    [Title],
    [Title2],
    [IsSystem],
    DefaultSelectInReport,
    IsActive,
    [Creator],
    [CreationDate],
    [LastEditor],
    [LastEditionDate],
    [Version],
    [engname]
)
SELECT @Title,
       @Title2,
       0,
       @DefaultSelectInReport,
       @isActive,
       @Creator,
       @CreationDate,
       @Creator,
       @CreationDate,
       0,
       @engname;

-- Begin Return Select <- do not remove
SELECT [DocumentTypeID],
       [Version]
FROM [ACC].[DocumentType]
WHERE [DocumentTypeID] = SCOPE_IDENTITY();
-- End Return Select <- do not remove
