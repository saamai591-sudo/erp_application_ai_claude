

CREATE   PROC [PRM].[spQualityParameterItemInsert]
    @QualityParameterID INT,
    @RowIndex SMALLINT,
    @Quantity DECIMAL(30, 4),
    @Passed BIT,
    @Creator INT,
    @CreationDate DATETIME
AS
SET NOCOUNT ON;

INSERT INTO [PRM].[QualityParameterItem]
(
    [QualityParameterID],
    [RowIndex],
    [Quantity],
    [Passed],
    [Creator],
    [CreationDate],
    [LastEditor],
    [LastEditionDate],
    [Version]
)
SELECT @QualityParameterID,
       @RowIndex,
       @Quantity,
       @Passed,
       @Creator,
       @CreationDate,
       @Creator,
       @CreationDate,
       0;

-- Begin Return Select <- do not remove
SELECT [QualityParameterItemID],
       [QualityParameterID],
       [RowIndex],
       [Quantity],
       [Passed],
       [Creator],
       [CreationDate],
       [LastEditor],
       [LastEditionDate],
       [Version]
FROM [PRM].[QualityParameterItem]
WHERE [QualityParameterItemID] = SCOPE_IDENTITY();
-- End Return Select <- do not remove

