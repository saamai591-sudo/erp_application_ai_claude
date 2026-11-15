
-----------------------------------------------------------------------
CREATE   VIEW hrm.vwPersonelStatusInDate
 as
 WITH cte
      as (
          SELECT *
          FROM   hrm.ChangePersonelStatus AS cps
      )
 
 SELECT a.PersonelID,
        dd.[Date]            DATE,
        dd.PersianFullDateAlternateKey,
        a.[STATUS]
 FROM   (
            SELECT ROW_NUMBER() OVER(PARTITION BY cps.PersonelID ORDER BY cps.ChangeDate) rno,
                   *
            FROM   cte AS cps
        ) a
        left JOIN (
                 SELECT ROW_NUMBER() OVER(PARTITION BY cps.PersonelID ORDER BY cps.ChangeDate) rno,
                        *
                 FROM   cte AS cps
             ) b
             ON  a.PersonelID = b.PersonelID
             AND a.rno = b.rno - 1
        JOIN cfg.DimDate  AS dd
             ON  dd.[Date] between a.ChangeDate and ISNULL(
                     DATEADD(DAY, -1, b.ChangeDate),
                     (
                         SELECT cm.EndDate
                         FROM   hrm.CalendarMonth AS cm
                         WHERE  GETDATE() between cm.StartDate and cm.EndDate
                     )
                 )
