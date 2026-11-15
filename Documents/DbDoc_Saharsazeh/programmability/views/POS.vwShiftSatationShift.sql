CREATE   VIEW POS.vwShiftSatationShift
AS
 
SELECT s.StationID,
       s.Title StationTitle,
       sf.Title
       ShiftTitle,
       CAST(s.Code AS NVARCHAR(50)) + '-' + CAST(sf.code AS NVARCHAR(50)) FullCode,
       StationShiftID
FROM   pos.StationShift sf
       JOIN pos.Station s
            ON  sf.StationID = s.StationID