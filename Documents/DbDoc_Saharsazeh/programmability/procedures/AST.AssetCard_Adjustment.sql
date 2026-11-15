-------------------------------------
CREATE   PROC [AST].[AssetCard_Adjustment]
    (
        @AssetID INT
    )
--WITH ENCRYPTION 
AS
    BEGIN

        SELECT   a.Number ,
				a.Date,
                 CFG.GetSaturnDate(a.Date, 0) Date_Date ,
                 ai.Amount ,
                 a.Description ,
                 a.Description2 ,
                 a.AdjustmentID
        FROM     AST.Adjustment a
                 JOIN AST.AdjustmentItem ai ON a.AdjustmentID = ai.AdjustmentID
        WHERE    ai.AssetID = @AssetID


    END;
