

CREATE   PROC [PRM].[spQualityParameterInsert]
    @Code INT,
    @Title NVARCHAR(256),
    @Title2 NVARCHAR(256),
    @Type TINYINT,
    @AcceptableQuantity DECIMAL(30, 4) = NULL,
    @Creator INT,
    @CreationDate DATETIME
AS
SET NOCOUNT ON;

INSERT INTO [PRM].[QualityParameter]
(
    [Code],
    [Title],
    [Title2],
    [Type],
    [AcceptableQuantity],
    [Creator],
    [CreationDate],
    [LastEditor],
    [LastEditionDate],
    [Version]
)
SELECT @Code,
       @Title,
       @Title2,
       @Type,
       @AcceptableQuantity,
       @Creator,
       @CreationDate,
       @Creator,
       @CreationDate,
       0;

-- Begin Return Select <- do not remove
SELECT [QualityParameterID],
       [Code],
       [Title],
       [Title2],
       [Type],
       [AcceptableQuantity],
       [Creator],
       [CreationDate],
       [LastEditor],
       [LastEditionDate],
       [Version]
FROM [PRM].[QualityParameter]
WHERE [QualityParameterID] = SCOPE_IDENTITY();
-- End Return Select <- do not remove

